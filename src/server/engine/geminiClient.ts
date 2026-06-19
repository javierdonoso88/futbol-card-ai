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
  return `Create a Panini FIFA World Cup 2026 official collectible sticker card. Follow these specifications EXACTLY.

CANVAS: Vertical portrait, 3:4 ratio (e.g. 600×800px). Rounded corners (~14px). No border.

--- BACKGROUND LAYER (bottom, full card) ---
Solid teal/mint color: #29B8B0 with very subtle paper grain texture.

--- DECORATIVE NUMBERS LAYER (behind person) ---
Large "2" on the LEFT side: bold, solid RED (#CC0000), very large (~70% of card height), positioned left-center, slightly cropped at left edge. Behind the person.
Large "6" on the RIGHT side: bold, solid YELLOW/GOLD (#F5C200), very large (~65% of card height), positioned right-center, slightly cropped at right edge. Behind the person.
Behind the person and between the numbers: a rectangular Spain flag overlay — left half RED (#CC0000) rectangle, right half YELLOW (#F5C200) rectangle, occupying the middle band of the card (~40% width, ~50% height), semi-transparent, blending with the teal background.

--- TOP-RIGHT CORNER ---
White FIFA World Cup 2026 trophy silhouette icon (~55×65px). Below the trophy icon: "FIFA" text in white, bold, small (~11px). This sits in the top-right area, above the "6".

--- PERSON LAYER (foreground, in front of everything) ---
Take the person from the provided photo. Remove their background completely using precise cutout. Place them centered horizontally, vertically filling from top (~10% from top) to about 72% of card height. Face must be large, clear and prominent. Upper body visible. The person appears IN FRONT of the numbers and flag shapes.

--- RIGHT SIDE ELEMENTS ---
Circular badge (~55px diameter), positioned at ~55% card height on the right edge (partially overlapping the card edge): Spain flag inside (horizontal red-yellow-red stripes).
"ESP" text vertically along the right edge below the badge: bold, dark teal (#1A7A75), rotated 90° clockwise, large letters (~28px each), stacked vertically E-S-P.

--- BOTTOM INFO SECTION (lower ~28% of card) ---
Dark teal rounded pill/capsule (full width minus 12px margin, ~52px tall, rounded ~26px):
  - Player name: "${req.playerName.toUpperCase()}" — white, bold, ~20px, centered.
Below the name pill, a second smaller dark teal pill (~40px tall):
  - "${req.role}  |  ${req.skill}" — white, semibold, ~13px, centered.
Below that, a third smaller pill:
  - "Estilo: ${req.leadershipStyle}" — white, regular, ~12px, centered.

--- FOOTER BAR (very bottom, ~12% of card height) ---
White/off-white background bar, full width, ~10% card height.
Left-center: "SAP" in SAP blue (#008FD3), bold ~16px.
Center divider: thin vertical line, gray.
Right-center: "BBVA" in BBVA dark blue (#004481), bold ~16px.
Both logos centered vertically in the footer bar.

--- FINAL CHECKLIST ---
✓ Portrait vertical orientation (taller than wide)
✓ Teal background
✓ Big red "2" left, big yellow "6" right, both behind person
✓ Spain flag colors rectangle in background center
✓ FIFA trophy top-right in white
✓ Person cutout centered and prominent, in foreground
✓ Circular Spain flag badge mid-right
✓ ESP vertical text right edge
✓ Name + role pills at bottom in dark teal
✓ SAP | BBVA footer white bar`;
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
