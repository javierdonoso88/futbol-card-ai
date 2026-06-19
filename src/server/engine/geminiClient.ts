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

const ROLE_COLORS: Record<Role, { bg: string; accent: string; text: string }> = {
  CEO: { bg: '#2EC4B6', accent: '#E63946',  text: 'CEO' },
  CFO: { bg: '#2EC4B6', accent: '#1D3557',  text: 'CFO' },
  CTO: { bg: '#2EC4B6', accent: '#F4A261',  text: 'CTO' },
  COO: { bg: '#2EC4B6', accent: '#6A0572',  text: 'COO' },
};

function buildPrompt(req: GenerateRequestBody): string {
  return `Generate a collectible sticker card image. The output image canvas MUST be 600 pixels wide and 840 pixels tall (600×840px). Portrait orientation. Taller than wide. Do not generate a landscape or square image.

Think of it as a smartphone screen held vertically, or a playing card standing upright (63mm wide × 88mm tall ratio).

Paint the following design on this 600×840 canvas, working from top (y=0) to bottom (y=840):

=== BACKGROUND (full 600×840 canvas) ===
Fill entire canvas with solid teal color #29B8B0. Add subtle paper grain texture overlay.
Rounded corners 16px.

=== DECORATIVE NUMBERS (y=0 to y=560, behind everything) ===
- Digit "2": font-size ~520px, bold, color #CC0000 (red), positioned at x=-20 y=-40, text anchor left. Behind the person.
- Digit "6": font-size ~520px, bold, color #F5C200 (yellow), positioned at x=260 y=-20, text anchor left. Behind the person.
- Spain flag rectangle: x=160 y=120, width=280 height=320. Left half red #CC0000, right half yellow #F5C200. Semi-transparent (opacity 0.7). Behind person.

=== TOP-RIGHT CORNER (x=460 to x=580, y=20 to y=100) ===
White FIFA World Cup trophy icon silhouette, ~50×60px, at x=490 y=25.
Text "FIFA" in white, bold 14px, centered below trophy at y=92.

=== PERSON (y=30 to y=560, centered horizontally) ===
Take the person from the provided photo. Remove their background with a precise cutout.
Place them centered at x=300, spanning from y=30 to y=560.
Face fills roughly y=30 to y=280. Upper body visible down to y=560.
Person appears IN FRONT of the "26" numbers and flag rectangle.

=== RIGHT SIDE ELEMENTS (x=540 to x=590) ===
Circular Spain flag badge, diameter 60px, center at x=545 y=460.
Text "E", "S", "P" stacked vertically at x=570, y=500/535/570, bold 28px, color #1A7A75.

=== BOTTOM INFO SECTION (y=570 to y=730) ===
Dark teal pill (#1A6B65), x=20 y=575, width=560 height=52, rounded 26px:
  Text "${req.playerName.toUpperCase()}" white bold 22px centered at y=608.

Dark teal pill (#1A6B65), x=20 y=635, width=560 height=40, rounded 20px:
  Text "${req.role}  |  ${req.skill}" white semibold 14px centered at y=660.

Dark teal pill (#1A6B65), x=20 y=683, width=560 height=36, rounded 18px:
  Text "Estilo: ${req.leadershipStyle}" white regular 13px centered at y=706.

=== FOOTER BAR (y=740 to y=840) ===
White rectangle x=0 y=740 width=600 height=100.
Text "SAP" in #008FD3 bold 20px at x=220 y=798.
Vertical line x=300 y=760 to y=820, color #CCCCCC, width 1px.
Text "BBVA" in #004481 bold 20px at x=370 y=798.

=== FINAL OUTPUT ===
Render all layers in order (background → numbers → person → details → pills → footer).
Output: single PNG image, exactly 600 wide × 840 tall pixels. PORTRAIT. NOT landscape. NOT square.`;
}

function buildDefaultStats(role: Role): { stats: CardStats; playerName: string } {
  const labels: Record<Role, string[]> = {
    CFO: ['VISION', 'STRATEGY', 'ANALYTICS', 'LEADERSHIP', 'NETWORKS', 'EXECUTION'],
    CTO: ['VISION', 'CODING', 'SECURITY', 'INNOVATION', 'LEADERSHIP', 'AGILITY'],
    COO: ['PROCESS', 'SUPPLY', 'TEAMS', 'KPIs', 'COACHING', 'EXECUTION'],
    CEO: ['VISION', 'STRATEGY', 'CULTURE', 'P&L', 'MARKET', 'LEADERSHIP'],
  };
  const l = labels[role];
  return {
    stats: {
      overall: 87,
      stat1: 89, label1: l[0], stat2: 86, label2: l[1],
      stat3: 83, label3: l[2], stat4: 91, label4: l[3],
      stat5: 77, label5: l[4], stat6: 88, label6: l[5],
    },
    playerName: 'THE EXECUTIVE',
  };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

// Force portrait 600×840: if the image is landscape or square, rotate it.
// If already portrait but wrong size, resize keeping aspect ratio centered on teal bg.
async function forcePortrait(base64: string): Promise<{ base64: string; mimeType: string }> {
  const TARGET_W = 600;
  const TARGET_H = 840;
  const buf = Buffer.from(base64, 'base64');
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? TARGET_W;
  const h = meta.height ?? TARGET_H;

  let pipeline = sharp(buf);

  // If landscape (wider than tall), rotate 90° clockwise
  if (w > h) {
    pipeline = pipeline.rotate(90);
  }

  // Resize to fit within 600×840, then composite centered on teal background
  const resized = await pipeline
    .resize(TARGET_W, TARGET_H, { fit: 'contain', background: { r: 41, g: 184, b: 176, alpha: 1 } })
    .png()
    .toBuffer();

  return { base64: resized.toString('base64'), mimeType: 'image/png' };
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
  console.log(`Gemini status: ${res.status}, snippet: ${text.substring(0, 120)}`);
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

  const { stats, playerName } = buildDefaultStats(req.role);

  if (imagePart?.inlineData) {
    const portrait = await forcePortrait(imagePart.inlineData.data);
    console.log('Portrait enforced:', portrait.mimeType);
    return {
      imageBase64: portrait.base64,
      mimeType: portrait.mimeType,
      stats,
      playerName: req.playerName || playerName,
      fallback: false,
    };
  }

  console.warn('No image returned, using original photo');
  return {
    imageBase64: req.imageBase64,
    mimeType: req.mimeType,
    stats,
    playerName: req.playerName || playerName,
    fallback: false,
  };
}
