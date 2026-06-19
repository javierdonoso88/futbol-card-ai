import type { Role, CardStats, GenerateRequestBody, GenerateResponse } from './types';

const CLIENT_ID      = process.env.AICORE_CLIENT_ID      ?? '';
const CLIENT_SECRET  = process.env.AICORE_CLIENT_SECRET  ?? '';
const TOKEN_URL      = process.env.AICORE_TOKEN_URL      ?? '';
const AI_API_URL     = process.env.AICORE_API_URL        ?? 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com';
const RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP ?? 'default';
const DEPLOYMENT_ID  = process.env.AICORE_DEPLOYMENT_ID  ?? 'd30c6e956b9084a8';

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

interface OAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string };
}

async function callGPT(token: string, messages: object[]): Promise<string> {
  const url = `${AI_API_URL}/v2/inference/deployments/${DEPLOYMENT_ID}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'AI-Resource-Group': RESOURCE_GROUP,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-5.5', messages }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GPT AI Core error ${res.status}: ${text}`);
  const data = JSON.parse(text) as OAIResponse;
  return data.choices?.[0]?.message?.content ?? '';
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const labels = STAT_LABELS[req.role];
  const dataUri = `data:${req.mimeType};base64,${req.imageBase64}`;

  // ── Call 1: generate stats (text/vision) ─────────────────────────────────
  const statsPrompt = `Analyze this executive's photo and generate their FIFA Ultimate Team card stats.
Role: ${req.role} | Skill: ${req.skill} | Style: ${req.leadershipStyle}

Return ONLY valid JSON, nothing else:
{"overall":88,"stat1":85,"label1":"${labels[0]}","stat2":82,"label2":"${labels[1]}","stat3":79,"label3":"${labels[2]}","stat4":91,"label4":"${labels[3]}","stat5":76,"label5":"${labels[4]}","stat6":84,"label6":"${labels[5]}","playerName":"THE VISIONARY"}

Rules: overall 82-95, each stat 72-99, boost stats linked to "${req.skill}" and "${req.leadershipStyle}", playerName uppercase 2-word title matching their look.`;

  const statsText = await callGPT(token, [
    { role: 'user', content: [
      { type: 'image_url', image_url: { url: dataUri, detail: 'low' } },
      { type: 'text', text: statsPrompt },
    ]},
  ]);
  console.log('Stats response:', statsText.substring(0, 200));
  const { stats, playerName } = parseStats(statsText, req.role, labels);

  // ── Call 2: generate the card image ──────────────────────────────────────
  const imagePrompt = `You are a digital artist. Transform this photo into a FIFA Ultimate Team gold collectible card image.

Requirements:
- Remove the original background completely, keep only the person
- Gold metallic card background: gradient from #8B6914 → #FFD700 → #FFF2AA → #FFD700 → #8B6914
- Subtle diagonal texture lines on the gold background
- Diagonal shimmer highlight (white semi-transparent stripe)
- Person centered on card with vignette fade at bottom, blending into the gold
- Top-left: large bold number "${stats.overall}" and text "${req.role}" below it
- Top-right: "★ ★ ★" and small badge "AI ELITE"
- Dark semi-transparent name banner below person: "${playerName}"
- Bottom 6 stats in 2 columns: ${labels.map((l, i) => `${[stats.stat1,stats.stat2,stats.stat3,stats.stat4,stats.stat5,stats.stat6][i]} ${l}`).join(', ')}
- Bottom footer: "FÚTBOL CARD AI"

Return ONLY the card image as a base64-encoded PNG data URI in this exact format:
data:image/png;base64,<base64data>

Do not include any text, explanation or JSON. Only the data URI.`;

  const imageText = await callGPT(token, [
    { role: 'user', content: [
      { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
      { type: 'text', text: imagePrompt },
    ]},
  ]);
  console.log('Image response snippet:', imageText.substring(0, 100));

  // Extract data URI from response
  const dataUriMatch = imageText.match(/data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)/);
  if (dataUriMatch) {
    const mimeType = dataUriMatch[1];
    const imageBase64 = dataUriMatch[2].replace(/\s/g, '');
    console.log('Extracted image, mimeType:', mimeType, 'length:', imageBase64.length);
    return { imageBase64, mimeType, stats, playerName, fallback: false };
  }

  // Model returned text instead of image — use original photo
  console.warn('GPT did not return an image data URI, using original photo');
  return { imageBase64: req.imageBase64, mimeType: req.mimeType, stats, playerName, fallback: false };
}
