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
  return `You are a professional graphic designer creating a Panini FIFA World Cup 2026 collectible sticker.

OUTPUT FORMAT: The image MUST be VERTICAL PORTRAIT orientation. Width:Height ratio = 3:4 (for example 600 wide × 800 tall pixels). This is a tall sticker, NOT square, NOT horizontal. Like a playing card standing upright.

EXACT DESIGN — replicate this structure from top to bottom:

TOP AREA (upper 60% of the sticker height):
- Background: solid teal/mint (#2EC4B6) with subtle paper grain texture
- Large "2" on the left side, dark forest green (#1B5E20), very bold, decorative, semi-transparent, takes up ~40% of width and ~50% of height — positioned behind the person
- Large "6" on the right side, terracotta/brick red (#BF360C), same style as the "2", partially behind the person
- Top-right corner: white FIFA World Cup trophy silhouette icon (~40×50px) with "AI CARD" text below it in white, small font
- THE PERSON: remove background completely, place them centered, face prominent, upper body visible, overlapping the "26" decorative numbers — the person appears IN FRONT of the numbers
- Bottom-right of photo area: circular badge with Spain flag (horizontal red-yellow-red stripes, ~50px diameter)
- Right edge: "ESP" text in white, bold, rotated 90° counterclockwise, running vertically along the right side

BOTTOM AREA (lower 40% of the sticker height):
- Rounded pill/capsule shape, orange-red (#D84315), full width minus small margins: player name "${req.playerName.toUpperCase()}" in large bold white text, centered
- Below it, 3 smaller orange-red rounded pills stacked with small gaps:
  * "${req.role} — ${req.skill}"
  * "Estilo: ${req.leadershipStyle}"
  * "SAP AI Core · Executive Card"
- White/cream footer bar at the very bottom: "SAP" in blue (#008FD3) | vertical divider | "BBVA" in dark blue (#004481), centered, bold

CARD FRAME:
- Rounded corners (~16px)
- Teal background (#2EC4B6) throughout
- NO border/stroke around the card edge

CRITICAL: Output MUST be portrait (tall), roughly 600×800px or similar portrait ratio. NOT landscape. NOT square.`;
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
      imageGenerationConfig: {
        aspectRatio: '3:4',
      },
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
    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
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
