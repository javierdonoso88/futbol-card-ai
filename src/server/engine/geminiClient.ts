import type { Role, CardStats, GenerateRequestBody, GenerateResponse } from './types';

const CLIENT_ID      = process.env.AICORE_CLIENT_ID      ?? '';
const CLIENT_SECRET  = process.env.AICORE_CLIENT_SECRET  ?? '';
const TOKEN_URL      = process.env.AICORE_TOKEN_URL      ?? '';
const AI_API_URL     = process.env.AICORE_API_URL        ?? 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com';
const RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP ?? 'default';
const DEPLOYMENT_ID  = process.env.AICORE_DEPLOYMENT_ID  ?? 'd8ba8af0c855151a';

interface TokenCache { token: string; expiresAt: number; }
let tokenCache: TokenCache | null = null;

// Discovered at first call, cached for subsequent calls
let workingEndpointForm: 'A' | 'B' | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - now > 60_000) return tokenCache.token;

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`AI Core OAuth error ${res.status}: ${await res.text()}`);

  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return tokenCache.token;
}

function buildEndpointUrl(form: 'A' | 'B'): string {
  const base = `${AI_API_URL}/v2/inference/deployments/${DEPLOYMENT_ID}`;
  return form === 'A'
    ? `${base}/models/gemini-3.5-flash:generateContent`
    : `${base}/models/gemini-2.0-flash:generateContent`;
}

const STAT_LABELS: Record<Role, string[]> = {
  CFO: ['VISION', 'STRATEGY', 'ANALYTICS', 'LEADERSHIP', 'NETWORKS', 'EXECUTION'],
  CTO: ['VISION', 'CODING', 'SECURITY', 'INNOVATION', 'LEADERSHIP', 'AGILITY'],
  COO: ['PROCESS', 'SUPPLY', 'TEAMS', 'KPIs', 'COACHING', 'EXECUTION'],
  CEO: ['VISION', 'STRATEGY', 'CULTURE', 'P&L', 'MARKET', 'LEADERSHIP'],
};

function buildPrompt(role: Role, skill: string, leadershipStyle: string, labels: string[]): string {
  return `You are a creative digital artist specializing in FIFA Ultimate Team collectible cards.

Your task: Transform the provided photo of a business executive into a FIFA Ultimate Team gold card image.

CRITICAL — Background removal:
- Remove the original photo background completely
- Keep ONLY the person (head, shoulders, upper body)
- Replace the background with the card's gold gradient so the person appears naturally integrated into the card

Card visual requirements:
- Style: FIFA Ultimate Team gold card (premium gold metallic card)
- Gold gradient background: from dark gold (#8B6914) through bright gold (#FFD700) with a light center highlight (#FFF2AA)
- Subtle diagonal texture pattern overlay on the card background
- A light shimmer effect (diagonal white highlight stripe)
- 2px golden border around the card
- The person centered on the card with NO original background — only the gold card background behind them
- Subtle vignette fade at the bottom of the person
- Large overall rating number in top-left corner (font: bold condensed, dark color)
- Role abbreviation "${role}" below the rating number
- Player name banner below the photo area
- 6 stat values at the bottom in 2 columns of 3: ${labels.join(', ')}
- "FUTBOL CARD AI" small text at the very bottom footer

Generate the complete FIFA UT card image with the person's face clearly visible and background removed.

After the image, output ONLY this JSON (no markdown, no explanation, nothing else):
{"overall":88,"stat1":85,"label1":"${labels[0]}","stat2":82,"label2":"${labels[1]}","stat3":79,"label3":"${labels[2]}","stat4":91,"label4":"${labels[3]}","stat5":76,"label5":"${labels[4]}","stat6":84,"label6":"${labels[5]}","playerName":"THE EXECUTIVE"}

Stats context (generate realistic values between 72-99):
- Role: ${role}
- Main skill: ${skill}
- Leadership style: ${leadershipStyle}
- The overall rating should be 80-95 for a C-Suite executive
- Boost the stats related to "${skill}" and "${leadershipStyle}"`;
}

function buildDefaultStats(role: Role, labels: string[]): CardStats {
  const base = 80;
  return {
    overall: 85,
    stat1: base + 8,  label1: labels[0],
    stat2: base + 5,  label2: labels[1],
    stat3: base + 2,  label3: labels[2],
    stat4: base + 11, label4: labels[3],
    stat5: base - 4,  label5: labels[4],
    stat6: base + 7,  label6: labels[5],
  };
}

function parseStats(text: string, role: Role, labels: string[]): CardStats {
  try {
    const match = text.match(/\{[\s\S]*?"overall"[\s\S]*?\}/);
    if (!match) return buildDefaultStats(role, labels);
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      overall: Number(raw.overall) || 85,
      stat1: Number(raw.stat1) || 80, label1: String(raw.label1 || labels[0]),
      stat2: Number(raw.stat2) || 80, label2: String(raw.label2 || labels[1]),
      stat3: Number(raw.stat3) || 80, label3: String(raw.label3 || labels[2]),
      stat4: Number(raw.stat4) || 80, label4: String(raw.label4 || labels[3]),
      stat5: Number(raw.stat5) || 80, label5: String(raw.label5 || labels[4]),
      stat6: Number(raw.stat6) || 80, label6: String(raw.label6 || labels[5]),
    };
  } catch {
    console.warn('Failed to parse stats JSON, using defaults');
    return buildDefaultStats(role, labels);
  }
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message: string };
}

async function callGemini(token: string, body: object): Promise<GeminiResponse> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'AI-Resource-Group': RESOURCE_GROUP,
    'Content-Type': 'application/json',
  };

  // Try the cached form first, then discover
  const formsToTry: Array<'A' | 'B'> = workingEndpointForm
    ? [workingEndpointForm]
    : ['A', 'B'];

  for (const form of formsToTry) {
    const url = buildEndpointUrl(form);
    console.log(`Trying Gemini endpoint form ${form}: ${url}`);
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (res.status === 404 && !workingEndpointForm) {
      console.log(`Form ${form} returned 404, trying next...`);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini AI Core error ${res.status}: ${errText}`);
    }

    workingEndpointForm = form;
    console.log(`Using Gemini endpoint form ${form}`);
    return await res.json() as GeminiResponse;
  }

  throw new Error('All Gemini endpoint forms returned 404. Check AI_CORE_API_URL and DEPLOYMENT_ID.');
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const labels = STAT_LABELS[req.role];
  const prompt = buildPrompt(req.role, req.skill, req.leadershipStyle, labels);

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

  let geminiRes: GeminiResponse;
  try {
    geminiRes = await callGemini(token, body);
  } catch (err) {
    // Try without responseModalities in case the AI Core version doesn't support it
    console.warn('Retrying without responseModalities:', (err as Error).message);
    const bodyNoModalities = { contents: (body as {contents: unknown[]}).contents };
    geminiRes = await callGemini(token, bodyNoModalities);
  }

  const parts = geminiRes.candidates?.[0]?.content?.parts ?? [];

  // Extract image and text parts
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  const textContent = parts.filter(p => p.text).map(p => p.text!).join('\n');

  const stats = parseStats(textContent, req.role, labels);
  const playerNameMatch = textContent.match(/"playerName"\s*:\s*"([^"]+)"/);
  const playerName = playerNameMatch?.[1] ?? 'THE EXECUTIVE';

  if (imagePart?.inlineData) {
    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      stats,
      playerName,
      fallback: false,
    };
  }

  // Fallback: no image returned by Gemini
  const fallbackReason = textContent.includes('unable') || textContent.includes('cannot')
    ? textContent.substring(0, 200)
    : 'Gemini did not return an image part';
  console.warn('Gemini returned no image:', fallbackReason);

  return {
    imageBase64: null,
    mimeType: req.mimeType,
    stats,
    playerName,
    fallback: true,
    fallbackReason,
  };
}
