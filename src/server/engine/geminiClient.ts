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

function buildDefaultStats(role: Role, labels: string[]): CardStats {
  return {
    overall: 87,
    stat1: 89, label1: labels[0], stat2: 86, label2: labels[1],
    stat3: 83, label3: labels[2], stat4: 91, label4: labels[3],
    stat5: 77, label5: labels[4], stat6: 88, label6: labels[5],
  };
}

function parseStats(text: string, role: Role, labels: string[]): { stats: CardStats; playerName: string } {
  try {
    const match = text.match(/\{[\s\S]*?"overall"[\s\S]*?\}/);
    if (!match) return { stats: buildDefaultStats(role, labels), playerName: 'THE EXECUTIVE' };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      stats: {
        overall: Number(raw.overall) || 87,
        stat1: Number(raw.stat1) || 80, label1: String(raw.label1 || labels[0]),
        stat2: Number(raw.stat2) || 80, label2: String(raw.label2 || labels[1]),
        stat3: Number(raw.stat3) || 80, label3: String(raw.label3 || labels[2]),
        stat4: Number(raw.stat4) || 80, label4: String(raw.label4 || labels[3]),
        stat5: Number(raw.stat5) || 80, label5: String(raw.label5 || labels[4]),
        stat6: Number(raw.stat6) || 80, label6: String(raw.label6 || labels[5]),
      },
      playerName: String(raw.playerName || 'THE EXECUTIVE').toUpperCase(),
    };
  } catch {
    return { stats: buildDefaultStats(role, labels), playerName: 'THE EXECUTIVE' };
  }
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
  console.log(`Calling gemini-2.5-flash-image: ${url}`);
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
  console.log(`Response status: ${res.status}, snippet: ${text.substring(0, 150)}`);
  return JSON.parse(text) as GeminiResponse;
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const labels = STAT_LABELS[req.role];

  const prompt = `You are a professional digital artist specializing in FIFA Ultimate Team collectible cards.

Transform the provided photo into a complete FIFA Ultimate Team gold card image.

CRITICAL INSTRUCTIONS:
1. Remove the person's background completely — keep ONLY the person (head + upper body)
2. Place the person on a gold metallic card background
3. The final output must be a complete card image (not just the person)

Card design:
- Gold metallic gradient background: #5C4409 → #C8960C → #FFD700 → #FFF2AA → #FFD700 → #C8960C → #5C4409
- Subtle diagonal texture lines on the gold
- Diagonal shimmer stripe (semi-transparent white)
- Person centered, upper body, vignette fade at bottom blending into the gold
- TOP LEFT: large bold rating number, role "${req.role}" below it
- TOP RIGHT: "★ ★ ★" stars and "AI ELITE" badge
- BELOW PERSON: dark semi-transparent name banner
- BOTTOM: 6 stats in 2 columns (3 left, 3 right)
- FOOTER: small "FÚTBOL CARD AI" text

After the card image, return ONLY this JSON (no markdown):
{"overall":88,"stat1":85,"label1":"${labels[0]}","stat2":82,"label2":"${labels[1]}","stat3":79,"label3":"${labels[2]}","stat4":91,"label4":"${labels[3]}","stat5":76,"label5":"${labels[4]}","stat6":84,"label6":"${labels[5]}","playerName":"THE VISIONARY"}

Stats rules: overall 82-95, each stat 72-99, boost stats for "${req.skill}" and "${req.leadershipStyle}", playerName uppercase 2-word title.`;

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

  console.log('Text snippet:', textContent.substring(0, 200));
  console.log('Image found:', !!imagePart, imagePart?.inlineData?.mimeType);

  const { stats, playerName } = parseStats(textContent, req.role, labels);

  if (imagePart?.inlineData) {
    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      stats,
      playerName,
      fallback: false,
    };
  }

  // Fallback: image not returned, use original photo with AI stats
  console.warn('No image in response, using original photo');
  return {
    imageBase64: req.imageBase64,
    mimeType: req.mimeType,
    stats,
    playerName,
    fallback: false,
  };
}
