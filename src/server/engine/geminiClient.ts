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
  const msg1 = `${req.role} — ${req.skill}`;
  const msg2 = `Estilo de liderazgo: ${req.leadershipStyle}`;
  const msg3 = `SAP AI Core · Executive Card`;

  return `Crear un cromo digital vertical en relación de aspecto 3:4, inspirado en cromos futbolísticos retro pero con acabado digital limpio y moderno. Usar la foto proporcionada como referencia principal para el retrato, manteniendo la identidad, rostro, barba, peinado, color de ojos y expresión natural de la persona. Recortar limpiamente a la persona del fondo original e integrarla en el centro del cromo, de pecho hacia arriba, con una camiseta de fútbol inspirada en España: roja, con detalles amarillos/dorados y azul marino, estilo selección española moderna, sin copiar exactamente una equipación oficial.

El fondo debe ser turquesa/aqua, con grandes formas gráficas abstractas o numerales en rojo y amarillo detrás del retrato. Mantener una composición limpia, deportiva y coleccionable. En la esquina superior derecha debe aparecer exactamente el mismo emblema blanco fijo usado en el cromo base, con el texto "FIFA" debajo y un pequeño "TM". No cambiar este logo por ningún otro icono.

En el lateral derecho, añadir una insignia con la bandera de España y el texto vertical "ESP" en letras grandes blancas o con contorno blanco. En la zona inferior, colocar una barra naranja redondeada con el nombre "${req.playerName.toUpperCase()}" en blanco, grande, centrado y en mayúsculas. Debajo, colocar tres barras naranjas redondeadas con estos tres mensajes exactos:
- Barra 1: "${msg1}"
- Barra 2: "${msg2}"
- Barra 3: "${msg3}"
Usar texto blanco centrado y perfectamente legible en cada barra.

En la parte inferior, incluir los logos de SAP y BBVA, equilibrados visualmente y alineados correctamente. No añadir estadísticas deportivas, puntuaciones, altura, peso, fecha, club ni información adicional.

El resultado debe ser un diseño digital limpio, nítido y profesional, sin simular papel, impresión física, arrugas, brillos, textura de cromo real, bordes envejecidos o material impreso. Cuidar especialmente los bordes del recorte, la legibilidad del texto, la alineación de los elementos y la coherencia visual.

IMPORTANTE — Formato obligatorio:
- Orientación VERTICAL, más alto que ancho, relación 3:4 (por ejemplo 600×800 píxeles)
- NO horizontal, NO cuadrado
- Canvas de 600 píxeles de ancho × 800 píxeles de alto

EVITAR:
- Simular papel físico, plástico, brillos, arrugas o textura de impresión
- Bordes gastados o envejecidos
- Cambiar el logo superior derecho
- Añadir estadísticas deportivas
- Deformar el rostro de la persona
- Texto ilegible o descentrado`;
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

// Ensure portrait 600×840 — resize to fit without rotating (rotation breaks the design)
async function forcePortrait(base64: string): Promise<{ base64: string; mimeType: string }> {
  const TARGET_W = 600;
  const TARGET_H = 840;
  const buf = Buffer.from(base64, 'base64');

  const resized = await sharp(buf)
    .resize(TARGET_W, TARGET_H, {
      fit: 'contain',
      background: { r: 41, g: 184, b: 176, alpha: 1 },
    })
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
