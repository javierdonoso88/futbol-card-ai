import type { Role, CardStats, GenerateRequestBody, GenerateResponse } from './types';

const CLIENT_ID      = process.env.AICORE_CLIENT_ID      ?? '';
const CLIENT_SECRET  = process.env.AICORE_CLIENT_SECRET  ?? '';
const TOKEN_URL      = process.env.AICORE_TOKEN_URL      ?? '';
const AI_API_URL     = process.env.AICORE_API_URL        ?? 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com';
const RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP ?? 'default';
const DEPLOYMENT_ID  = process.env.AICORE_DEPLOYMENT_ID  ?? 'd8ba8af0c855151a';

interface TokenCache { token: string; expiresAt: number; }
let tokenCache: TokenCache | null = null;
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

// Gemini vision-only: analyze the photo and generate personalized stats
function buildPrompt(role: Role, skill: string, leadershipStyle: string, labels: string[]): string {
  return `You are an expert talent analyst and executive coach. Analyze the person in this photo.

Based on their appearance, expression, confidence, and presence, generate personalized executive stats for their collectible card.

They are a ${role} executive with main skill "${skill}" and leadership style "${leadershipStyle}".

Generate a name for them based on their appearance (e.g. "THE STRATEGIST", "THE VISIONARY", "THE ARCHITECT", etc. — something that fits their look and role).

Return ONLY valid JSON, no markdown, no explanation:
{"overall":88,"stat1":85,"label1":"${labels[0]}","stat2":82,"label2":"${labels[1]}","stat3":79,"label3":"${labels[2]}","stat4":91,"label4":"${labels[3]}","stat5":76,"label5":"${labels[4]}","stat6":84,"label6":"${labels[5]}","playerName":"THE VISIONARY"}

Rules:
- overall: 80-95 (C-Suite executive, always high)
- Each stat: 72-99
- Boost stats related to "${skill}" and "${leadershipStyle}"
- playerName: a short 2-word uppercase title that fits their appearance and role
- Return ONLY the JSON object, nothing else`;
}

function buildDefaultStats(role: Role, labels: string[]): CardStats {
  const base = 80;
  return {
    overall: 87,
    stat1: base + 9,  label1: labels[0],
    stat2: base + 6,  label2: labels[1],
    stat3: base + 3,  label3: labels[2],
    stat4: base + 12, label4: labels[3],
    stat5: base - 3,  label5: labels[4],
    stat6: base + 8,  label6: labels[5],
  };
}

function parseStats(text: string, role: Role, labels: string[]): { stats: CardStats; playerName: string } {
  try {
    const match = text.match(/\{[\s\S]*?"overall"[\s\S]*?\}/);
    if (!match) return { stats: buildDefaultStats(role, labels), playerName: 'THE EXECUTIVE' };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const stats: CardStats = {
      overall: Number(raw.overall) || 87,
      stat1: Number(raw.stat1) || 80, label1: String(raw.label1 || labels[0]),
      stat2: Number(raw.stat2) || 80, label2: String(raw.label2 || labels[1]),
      stat3: Number(raw.stat3) || 80, label3: String(raw.label3 || labels[2]),
      stat4: Number(raw.stat4) || 80, label4: String(raw.label4 || labels[3]),
      stat5: Number(raw.stat5) || 80, label5: String(raw.label5 || labels[4]),
      stat6: Number(raw.stat6) || 80, label6: String(raw.label6 || labels[5]),
    };
    const playerName = String(raw.playerName || 'THE EXECUTIVE').toUpperCase();
    return { stats, playerName };
  } catch {
    console.warn('Failed to parse stats JSON, using defaults');
    return { stats: buildDefaultStats(role, labels), playerName: 'THE EXECUTIVE' };
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

  const formsToTry: Array<'A' | 'B'> = workingEndpointForm ? [workingEndpointForm] : ['A', 'B'];

  for (const form of formsToTry) {
    const url = buildEndpointUrl(form);
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (res.status === 404 && !workingEndpointForm) continue;

    if (!res.ok) {
      throw new Error(`Gemini AI Core error ${res.status}: ${await res.text()}`);
    }

    workingEndpointForm = form;
    return await res.json() as GeminiResponse;
  }

  throw new Error('All Gemini endpoint forms returned 404. Check AI_CORE_API_URL and DEPLOYMENT_ID.');
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const labels = STAT_LABELS[req.role];
  const prompt = buildPrompt(req.role, req.skill, req.leadershipStyle, labels);

  // Vision-only: send image + prompt, receive text with JSON stats
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
        { text: prompt },
      ],
    }],
  };

  const geminiRes = await callGemini(token, body);
  const parts = geminiRes.candidates?.[0]?.content?.parts ?? [];
  const textContent = parts.filter(p => p.text).map(p => p.text!).join('\n');

  console.log('Gemini response text:', textContent.substring(0, 300));

  const { stats, playerName } = parseStats(textContent, req.role, labels);

  // Always use the original photo — Gemini analyzes it, the card renders it
  return {
    imageBase64: req.imageBase64,
    mimeType: req.mimeType,
    stats,
    playerName,
    fallback: false,
  };
}
