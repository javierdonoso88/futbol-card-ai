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
  const msg1 = `${req.role} — ${req.skill}`;
  const msg2 = `Estilo: ${req.leadershipStyle}`;
  const msg3 = `SAP AI Core · Executive Card`;

  return `TASK: Take the person from Image 1 (the photo) and place them onto a collectible sticker card.

The final result must be a VERTICAL portrait image (600×800px, taller than wide, 3:4 ratio).

STEP 1 — Extract the person from Image 1:
- Cut out the person with a clean, precise background removal
- Keep: face, hair, beard, shoulders, upper chest
- Remove: everything that is not the person (background, furniture, walls, etc.)
- Dress the person in a red Spain football jersey (red shirt, yellow/gold details, blue navy accents)

STEP 2 — Build the card background (paint this from scratch):
- Full card background: solid teal color #29B8B0, rounded corners 16px
- Large "2" digit: solid RED (#CC0000), font-size ~580px bold, positioned left side, partially cropped. Behind the person.
- Large "6" digit: solid YELLOW (#F5C200), font-size ~580px bold, positioned right side, partially cropped. Behind the person.
- Top-right corner: white FIFA World Cup trophy silhouette with "FIFA" text below in white
- Right side (~55% height): circular Spain flag badge (red stripe, yellow stripe, red stripe)
- Right edge: letters E, S, P stacked vertically in bold white

STEP 3 — Composite person onto card:
- Place the extracted person IN FRONT of the "26" background numbers
- Center them horizontally
- Position vertically: face starts near top (y≈50px), body extends to y≈590px
- The person's face must be large, clear, prominent — taking up roughly 40% of the card height
- Person is IN FRONT of everything in the background

STEP 4 — Add bottom info section:
- Orange pill (#E8441A), full-width, rounded: "${req.playerName.toUpperCase()}" in large bold white text
- 3 smaller orange pills below:
  1. "${msg1}"
  2. "${msg2}"
  3. "${msg3}"
- White rounded rectangle at very bottom: "SAP" in blue | divider | "BBVA" in dark blue

OUTPUT: Single vertical PNG image, 600 wide × 800 tall. Portrait. The person must be clearly visible in the upper portion of the card.`;
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
    console.log('Image received from Gemini, mimeType:', imagePart.inlineData.mimeType);
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
