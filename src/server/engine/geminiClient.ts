import sharp from 'sharp';
import type { Role, CardStats, GenerateRequestBody, GenerateResponse } from './types';

const CLIENT_ID      = process.env.AICORE_CLIENT_ID      ?? '';
const CLIENT_SECRET  = process.env.AICORE_CLIENT_SECRET  ?? '';
const TOKEN_URL      = process.env.AICORE_TOKEN_URL      ?? '';
const AI_API_URL     = process.env.AICORE_API_URL        ?? 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com';
const RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP ?? 'default';
const DEPLOYMENT_ID  = process.env.AICORE_DEPLOYMENT_ID  ?? 'de802b9a73842b77';

interface TokenCache { token: string; expiresAt: number; }
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - now > 60_000) return tokenCache.token;
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`AI Core OAuth error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return tokenCache.token;
}

const STAT_LABELS: Record<Role, string[]> = {
  CFO: ['VISION', 'STRATEGY', 'ANALYTICS', 'LEADERSHIP', 'NETWORKS', 'EXECUTION'],
  CTO: ['VISION', 'CODING', 'SECURITY', 'INNOVATION', 'LEADERSHIP', 'AGILITY'],
  COO: ['PROCESS', 'SUPPLY', 'TEAMS', 'KPIs', 'COACHING', 'EXECUTION'],
  CEO: ['VISION', 'STRATEGY', 'CULTURE', 'P&L', 'MARKET', 'LEADERSHIP'],
};

function buildDefaultStats(role: Role): { stats: CardStats; playerName: string } {
  const labels = STAT_LABELS[role];
  return {
    stats: {
      overall: 87,
      stat1: 89, label1: labels[0], stat2: 86, label2: labels[1],
      stat3: 83, label3: labels[2], stat4: 91, label4: labels[3],
      stat5: 77, label5: labels[4], stat6: 88, label6: labels[5],
    },
    playerName: 'THE EXECUTIVE',
  };
}

function buildPrompt(req: GenerateRequestBody): string {
  const msg1 = `${req.role} — ${req.skill}`;
  const msg2 = `Estilo: ${req.leadershipStyle}`;
  const msg3 = `SAP AI Core · Executive Card`;

  return `TASK: Take the person from the photo and create a FIFA World Cup 2026 Panini collectible sticker card.

The card design:
- Background: solid teal #29B8B0
- Large red "2" on left side (behind person), large yellow "6" on right side (behind person)
- Person in center foreground, background removed, wearing red Spain football jersey
- Top-right: white FIFA trophy + "FIFA" text
- Right side: Spain flag circular badge, ESP text vertically
- Bottom: orange pill with "${req.playerName.toUpperCase()}", 3 smaller orange pills: "${msg1}", "${msg2}", "${msg3}"
- Footer: white bar with SAP blue | BBVA dark blue

Make the person large and prominent. The card must be taller than wide.`;
}

// Gemini always outputs landscape 1248×832 — crop the center 3:4 portion to get portrait.
async function cropToPortrait(base64: string): Promise<{ base64: string; mimeType: string }> {
  const buf = Buffer.from(base64, 'base64');
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 1248;
  const h = meta.height ?? 832;
  if (h >= w) return { base64, mimeType: 'image/png' };
  const newW = Math.round(h * 3 / 4);
  const left = Math.round((w - newW) / 2);
  const cropped = await sharp(buf).extract({ left, top: 0, width: newW, height: h }).png().toBuffer();
  return { base64: cropped.toString('base64'), mimeType: 'image/png' };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

async function callGemini(token: string, body: object): Promise<GeminiResponse> {
  const url = `${AI_API_URL}/v2/inference/deployments/${DEPLOYMENT_ID}/models/gemini-2.5-flash-image:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'AI-Resource-Group': RESOURCE_GROUP,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini AI Core error ${res.status}: ${text}`);
  console.log(`Gemini status: ${res.status}, snippet: ${text.substring(0, 80)}`);
  return JSON.parse(text) as GeminiResponse;
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const prompt = buildPrompt(req);

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  };

  const geminiRes = await callGemini(token, body);
  const parts = geminiRes.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  const textContent = parts.filter(p => p.text).map(p => p.text!).join('\n');
  console.log('Text snippet:', textContent.substring(0, 150));
  console.log('Image found:', !!imagePart, imagePart?.inlineData?.mimeType);

  const { stats } = buildDefaultStats(req.role);

  if (imagePart?.inlineData) {
    const portrait = await cropToPortrait(imagePart.inlineData.data);
    return {
      imageBase64: portrait.base64,
      mimeType: portrait.mimeType,
      stats,
      playerName: req.playerName,
      fallback: false,
    };
  }

  console.warn('No image returned, using original photo');
  return {
    imageBase64: req.imageBase64,
    mimeType: req.mimeType,
    stats,
    playerName: req.playerName,
    fallback: false,
  };
}
