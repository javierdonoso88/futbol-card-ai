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

const STAT_LABELS: Record<Role, string[]> = {
  CFO: ['VISION', 'STRATEGY', 'ANALYTICS', 'LEADERSHIP', 'NETWORKS', 'EXECUTION'],
  CTO: ['VISION', 'CODING', 'SECURITY', 'INNOVATION', 'LEADERSHIP', 'AGILITY'],
  COO: ['PROCESS', 'SUPPLY', 'TEAMS', 'KPIs', 'COACHING', 'EXECUTION'],
  CEO: ['VISION', 'STRATEGY', 'CULTURE', 'P&L', 'MARKET', 'LEADERSHIP'],
};

function buildPrompt(role: Role, skill: string, leadershipStyle: string, labels: string[]): string {
  return `You are a creative digital artist specializing in FIFA Ultimate Team collectible cards.

Generate a complete FIFA Ultimate Team gold card image featuring the person from the provided photo as a top C-Suite executive player.

IMPORTANT — Background:
- Remove the original photo background completely
- Place the person on the card's gold gradient background

Card design specifications:
- Style: FIFA Ultimate Team gold card (premium metallic gold card)
- Background: gold gradient from dark gold (#8B6914) through bright gold (#FFD700) to light highlight (#FFF2AA) and back
- Subtle diagonal texture lines overlaid on the gold background
- Diagonal shimmer highlight stripe (white, semi-transparent)
- 2px golden border with slight rounded corners
- Person centered in the card (head and upper body), blending naturally into the gold background with a vignette fade at the bottom
- Top-left corner: large overall rating number (bold condensed dark font), role abbreviation "${role}" below it
- Top-right corner: 3 gold stars and a small "AI ELITE" badge
- Below the person: player name banner (dark semi-transparent strip)
- Bottom section: 6 stats in 2 columns of 3: ${labels.join(', ')}
- Very bottom: small "FÚTBOL CARD AI" text

After the card image, return ONLY this JSON (no markdown, no text):
{"overall":88,"stat1":85,"label1":"${labels[0]}","stat2":82,"label2":"${labels[1]}","stat3":79,"label3":"${labels[2]}","stat4":91,"label4":"${labels[3]}","stat5":76,"label5":"${labels[4]}","stat6":84,"label6":"${labels[5]}","playerName":"THE EXECUTIVE"}

Stats rules (values 72–99):
- Role: ${role} | Skill: ${skill} | Style: ${leadershipStyle}
- overall: 82–95 for a C-Suite executive
- Boost stats linked to "${skill}" and "${leadershipStyle}"
- playerName: short uppercase title matching their appearance (e.g. "THE VISIONARY", "THE ARCHITECT")`;
}

function buildDefaultStats(role: Role, labels: string[]): CardStats {
  return {
    overall: 87,
    stat1: 89, label1: labels[0],
    stat2: 86, label2: labels[1],
    stat3: 83, label3: labels[2],
    stat4: 91, label4: labels[3],
    stat5: 77, label5: labels[4],
    stat6: 88, label6: labels[5],
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
    console.warn('Failed to parse stats JSON, using defaults');
    return { stats: buildDefaultStats(role, labels), playerName: 'THE EXECUTIVE' };
  }
}

// OpenAI response types
interface OAIContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
  // GPT-5.5 may return image data inline
  image_data?: { data: string; media_type: string };
}

interface OAIResponse {
  choices?: Array<{
    message?: {
      content?: string | OAIContentPart[];
    };
  }>;
  error?: { message: string; type: string };
}

async function callGPT(token: string, body: object): Promise<OAIResponse> {
  const url = `${AI_API_URL}/v2/inference/deployments/${DEPLOYMENT_ID}/v1/chat/completions`;
  console.log(`Calling GPT-5.5 at: ${url}`);

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
  console.log(`GPT response status: ${res.status}, body snippet: ${text.substring(0, 300)}`);

  if (!res.ok) throw new Error(`GPT AI Core error ${res.status}: ${text}`);

  return JSON.parse(text) as OAIResponse;
}

function extractImageFromResponse(content: string | OAIContentPart[] | undefined): { imageBase64: string; mimeType: string } | null {
  if (!content) return null;

  // Array of parts (multimodal response)
  if (Array.isArray(content)) {
    for (const part of content) {
      // Standard image_url with data URI
      if (part.type === 'image_url' && part.image_url?.url) {
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          const [header, data] = url.split(',');
          const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png';
          return { imageBase64: data, mimeType };
        }
      }
      // GPT-5.5 inline image_data style
      if (part.type === 'image_data' && part.image_data?.data) {
        return { imageBase64: part.image_data.data, mimeType: part.image_data.media_type ?? 'image/png' };
      }
    }
  }

  // String content — look for embedded base64 data URI
  if (typeof content === 'string') {
    const dataUriMatch = content.match(/data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)/);
    if (dataUriMatch) {
      return { imageBase64: dataUriMatch[2], mimeType: dataUriMatch[1] };
    }
  }

  return null;
}

function extractText(content: string | OAIContentPart[] | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text' && p.text).map(p => p.text!).join('\n');
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const labels = STAT_LABELS[req.role];
  const prompt = buildPrompt(req.role, req.skill, req.leadershipStyle, labels);

  const body = {
    model: 'gpt-5.5',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${req.mimeType};base64,${req.imageBase64}`, detail: 'high' },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  };

  const gptRes = await callGPT(token, body);
  const messageContent = gptRes.choices?.[0]?.message?.content;

  const imageResult = extractImageFromResponse(messageContent);
  const textContent  = extractText(messageContent);

  console.log('Text content snippet:', textContent.substring(0, 300));

  const { stats, playerName } = parseStats(textContent, req.role, labels);

  if (imageResult) {
    console.log('GPT returned image:', imageResult.mimeType);
    return {
      imageBase64: imageResult.imageBase64,
      mimeType: imageResult.mimeType,
      stats,
      playerName,
      fallback: false,
    };
  }

  // No image returned — use original photo with AI-generated stats
  console.warn('GPT did not return an image, using original photo with AI stats');
  return {
    imageBase64: req.imageBase64,
    mimeType: req.mimeType,
    stats,
    playerName,
    fallback: false,
  };
}
