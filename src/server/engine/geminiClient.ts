import sharp from 'sharp';
import type { Role, CardStats, GenerateRequestBody, GenerateResponse } from './types';

const CLIENT_ID      = process.env.AICORE_CLIENT_ID      ?? '';
const CLIENT_SECRET  = process.env.AICORE_CLIENT_SECRET  ?? '';
const TOKEN_URL      = process.env.AICORE_TOKEN_URL      ?? '';
const AI_API_URL     = process.env.AICORE_API_URL        ?? 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com';
const RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP ?? 'default';
const DEPLOYMENT_ID  = process.env.AICORE_DEPLOYMENT_ID  ?? 'd8f5acc2ce8a047a';

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

function buildPrompt(_req: GenerateRequestBody): string {
  // Titan text limit: 512 chars max
  return 'FIFA World Cup 2026 Panini sticker card portrait. Person wearing red Spain football jersey. Teal aqua background. Large red number 2 left side, large yellow number 6 right side, both behind person. White FIFA trophy top right. Spain flag badge right side. ESP vertical letters right edge. Orange rounded banners bottom. White footer SAP BBVA logos. Person centered prominent face visible. Clean digital design.';
}

// Overlay readable text on top of Titan image using sharp SVG compositing
async function overlayText(base64: string, playerName: string, msg1: string, msg2: string, msg3: string): Promise<string> {
  const buf = Buffer.from(base64, 'base64');
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 768;
  const H = meta.height ?? 1152;

  const pillW   = Math.round(W * 0.86);
  const pillX   = Math.round((W - pillW) / 2);
  const coverH  = Math.round(H * 0.32); // cover bottom 32% with teal to erase Titan's text
  const coverY  = Math.round(H * 0.68);

  const pillH   = 58;
  const nameY   = coverY + 14;
  const p2Y     = nameY + pillH + 8;
  const p3Y     = p2Y + 42 + 6;
  const p4Y     = p3Y + 42 + 6;
  const footerY = p4Y + 42 + 12;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <!-- Cover bottom section with teal to erase Titan's garbled text -->
    <rect x="0" y="${coverY}" width="${W}" height="${coverH}" fill="#29B8B0" rx="0"/>
    <!-- Name pill (large) -->
    <rect x="${pillX}" y="${nameY}" width="${pillW}" height="${pillH}" rx="29" fill="#E8441A"/>
    <text x="${W / 2}" y="${nameY + 40}" font-family="Arial Black,sans-serif" font-weight="900" font-size="30" fill="white" text-anchor="middle">${playerName.toUpperCase()}</text>
    <!-- Msg 1 -->
    <rect x="${pillX}" y="${p2Y}" width="${pillW}" height="40" rx="20" fill="#E8441A"/>
    <text x="${W / 2}" y="${p2Y + 27}" font-family="Arial,sans-serif" font-weight="700" font-size="18" fill="white" text-anchor="middle">${msg1}</text>
    <!-- Msg 2 -->
    <rect x="${pillX}" y="${p3Y}" width="${pillW}" height="40" rx="20" fill="#E8441A"/>
    <text x="${W / 2}" y="${p3Y + 27}" font-family="Arial,sans-serif" font-weight="700" font-size="18" fill="white" text-anchor="middle">${msg2}</text>
    <!-- Msg 3 -->
    <rect x="${pillX}" y="${p4Y}" width="${pillW}" height="40" rx="20" fill="#E8441A"/>
    <text x="${W / 2}" y="${p4Y + 27}" font-family="Arial,sans-serif" font-weight="700" font-size="18" fill="white" text-anchor="middle">${msg3}</text>
    <!-- SAP | BBVA footer -->
    <rect x="${pillX}" y="${footerY}" width="${pillW}" height="44" rx="22" fill="white"/>
    <text x="${W * 0.36}" y="${footerY + 29}" font-family="Arial Black,sans-serif" font-weight="900" font-size="22" fill="#008FD3" text-anchor="middle">SAP</text>
    <line x1="${W * 0.5}" y1="${footerY + 8}" x2="${W * 0.5}" y2="${footerY + 36}" stroke="#CCCCCC" stroke-width="2"/>
    <text x="${W * 0.64}" y="${footerY + 29}" font-family="Arial Black,sans-serif" font-weight="900" font-size="22" fill="#004481" text-anchor="middle">BBVA</text>
  </svg>`;

  const result = await sharp(buf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result.toString('base64');
}

// Prepare input image for Titan: convert to JPEG square 512×512
async function prepareInputImage(base64: string, mimeType: string): Promise<string> {
  const inputBuf = Buffer.from(base64, 'base64');
  const jpegBuf = await sharp(inputBuf)
    .resize(512, 512, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 90 })
    .toBuffer();
  return jpegBuf.toString('base64');
}

interface TitanResponse {
  images?: string[];
  error?: string;
  message?: string;
}

async function callTitan(token: string, body: object): Promise<TitanResponse> {
  const url = `${AI_API_URL}/v2/inference/deployments/${DEPLOYMENT_ID}/invoke`;
  console.log('Calling Titan at:', url);
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
  if (!res.ok) throw new Error(`Titan AI Core error ${res.status}: ${text}`);
  console.log('Titan status:', res.status, '| snippet:', text.substring(0, 80));
  return JSON.parse(text) as TitanResponse;
}

export async function generateCard(req: GenerateRequestBody): Promise<GenerateResponse> {
  const token = await getAccessToken();
  const prompt = buildPrompt(req);

  // Prepare square input image for Titan
  const inputBase64 = await prepareInputImage(req.imageBase64, req.mimeType);

  const body = {
    taskType: 'IMAGE_VARIATION',
    imageVariationParams: {
      text: prompt,
      negativeText: 'blurry, bad quality, distorted face, text errors, duplicate, watermark, landscape orientation',
      images: [inputBase64],
      similarityStrength: 0.7,
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      width: 768,
      height: 1152,
      cfgScale: 8.0,
    },
  };

  const titanRes = await callTitan(token, body);

  if (!titanRes.images?.[0]) {
    console.warn('Titan returned no image, using original photo');
    const { stats, playerName } = buildDefaultStats(req.role);
    return { imageBase64: req.imageBase64, mimeType: req.mimeType, stats, playerName: req.playerName, fallback: false };
  }

  // Overlay correct text (Titan's text generation is unreliable)
  const msg1 = `${req.role} — ${req.skill}`;
  const msg2 = `Estilo: ${req.leadershipStyle}`;
  const msg3 = `SAP AI Core · Executive Card`;
  const finalBase64 = await overlayText(titanRes.images[0], req.playerName, msg1, msg2, msg3);

  const { stats } = buildDefaultStats(req.role);
  console.log('Card generated successfully with Titan + SVG overlay');
  return {
    imageBase64: finalBase64,
    mimeType: 'image/png',
    stats,
    playerName: req.playerName,
    fallback: false,
  };
}
