# Fútbol Card AI

Aplicación web desplegada en **SAP BTP Cloud Foundry** que genera cromos digitales estilo Panini FIFA World Cup 2026 a partir de una foto de usuario, usando **Gemini 2.5 Flash Image** vía **SAP AI Core**.

**URL producción:** https://futbol-card-ai.cfapps.eu10.hana.ondemand.com  
**GitHub:** https://github.com/javierdonoso88/futbol-card-ai

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Framer Motion |
| Backend | Express.js + TypeScript |
| IA | Gemini 2.5 Flash Image via SAP AI Core |
| Post-proceso | Sharp (redimensionar imagen a portrait 600×840) |
| Despliegue | Cloud Foundry — nodejs_buildpack |

---

## Estructura del proyecto

```
futbol-card-ai/
├── src/
│   ├── client/                  # React frontend
│   │   ├── App.tsx              # Máquina de estados: upload → loading → result
│   │   ├── types.ts             # Tipos compartidos del cliente
│   │   ├── index.css            # Estilos globales (TailwindCSS + custom)
│   │   └── components/
│   │       ├── DropZone.tsx     # Drag & drop + compresión automática >3MB
│   │       ├── RoleSelectors.tsx # 3 selectores en cascada (rol, habilidad, estilo)
│   │       ├── GenerateButton.tsx
│   │       └── PlayerCard.tsx   # Muestra la imagen generada por IA
│   └── server/                  # Express backend
│       ├── index.ts             # Servidor Express, límite 50mb
│       ├── routes/generate.ts   # POST /api/generate
│       └── engine/
│           ├── geminiClient.ts  # OAuth BTP + llamada a Gemini + post-proceso sharp
│           └── types.ts         # Tipos del servidor
├── manifest.yml                 # Configuración Cloud Foundry
├── package.json
├── tsconfig.json                # Config TypeScript cliente (noEmit)
├── tsconfig.node.json           # Config TypeScript servidor (outDir: dist/server)
└── vite.config.ts               # Build cliente → dist/client, proxy /api → :3001
```

---

## Flujo de la aplicación

1. Usuario sube foto (drag & drop), introduce su nombre y selecciona rol/habilidad/estilo
2. Frontend envía `POST /api/generate` con `{ imageBase64, mimeType, role, skill, leadershipStyle, playerName }`
3. Servidor obtiene token OAuth de SAP BTP, llama a Gemini 2.5 Flash Image
4. Gemini genera el cromo completo como imagen PNG
5. `sharp` redimensiona a portrait 600×840 si es necesario
6. Frontend muestra la imagen generada directamente (sin HTML encima)
7. Botón de descarga descarga el PNG directamente

---

## Variables de entorno

Configuradas en CF con `cf set-env`. **No están en el manifest** por seguridad.

| Variable | Descripción |
|----------|-------------|
| `AICORE_API_URL` | `https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com` |
| `AICORE_CLIENT_ID` | OAuth client ID del service binding de AI Core |
| `AICORE_CLIENT_SECRET` | OAuth client secret |
| `AICORE_TOKEN_URL` | `https://<subdominio>.authentication.eu10.hana.ondemand.com/oauth/token` |
| `AICORE_RESOURCE_GROUP` | `default` |
| `AICORE_DEPLOYMENT_ID` | ID del deployment de Gemini 2.5 Flash Image |

### Deployments activos en AI Core

| Deployment ID | Modelo | Uso |
|---------------|--------|-----|
| `de802b9a73842b77` | gemini-2.5-flash-image | **Activo** — genera cromos |
| `d30c6e956b9084a8` | gpt-5.5 | En desuso (no genera imágenes) |
| `d8ba8af0c855151a` | gemini-3.5-flash | En desuso (solo texto) |

---

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env con las credenciales de AI Core
cp .env.example .env   # (o crea .env manualmente)

# 3. Arrancar en modo desarrollo (servidor :3001 + cliente Vite :5173)
npm run dev
```

El `.env` necesita:
```
AICORE_API_URL=https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com
AICORE_CLIENT_ID=<client_id>
AICORE_CLIENT_SECRET=<client_secret>
AICORE_TOKEN_URL=https://<subdominio>.authentication.eu10.hana.ondemand.com/oauth/token
AICORE_RESOURCE_GROUP=default
AICORE_DEPLOYMENT_ID=de802b9a73842b77
PORT=3001
```

---

## Build y despliegue

```bash
# Build de producción
npm run build
# Genera: dist/server/ (Express compilado) + dist/client/ (React compilado)

# Test local en modo producción
node dist/server/index.js

# Desplegar en Cloud Foundry
cf login --sso   # obtener passcode en https://login.cf.eu10.hana.ondemand.com/passcode
cf push

# Configurar variables (solo la primera vez o al cambiar)
cf set-env futbol-card-ai AICORE_CLIENT_ID "..."
cf set-env futbol-card-ai AICORE_CLIENT_SECRET "..."
cf set-env futbol-card-ai AICORE_TOKEN_URL "..."
cf set-env futbol-card-ai AICORE_API_URL "..."
cf set-env futbol-card-ai AICORE_RESOURCE_GROUP "default"
cf set-env futbol-card-ai AICORE_DEPLOYMENT_ID "de802b9a73842b77"
cf restage futbol-card-ai
```

> **Importante:** después de cada cambio hacer `git push` + `cf push`.

---

## Módulo geminiClient.ts — cómo funciona

```
getAccessToken()
  └── OAuth2 client_credentials → Bearer token (cacheado 1h)

generateCard(req)
  ├── buildPrompt(req) → prompt detallado estilo Panini WC2026
  ├── callGemini(token, body)
  │     └── POST /v2/inference/deployments/{ID}/models/gemini-2.5-flash-image:generateContent
  │         body: { contents: [{ role: 'user', parts: [inlineData(foto), text(prompt)] }],
  │                 generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }
  ├── Extraer imagePart (inlineData PNG) de la respuesta
  ├── forcePortrait(base64) → sharp resize a 600×840 sin rotar
  └── Devolver { imageBase64, mimeType, stats, playerName, fallback }
```

---

## El prompt del cromo

El prompt en `buildPrompt()` instruye a Gemini a:
1. Extraer la persona de la foto (background removal)
2. Vestirla con camiseta roja de España
3. Construir el fondo: teal #29B8B0, dígito "2" rojo, dígito "6" amarillo, logo FIFA top-right, bandera ESP
4. Compositar persona sobre fondo
5. Añadir pills naranjas con nombre y mensajes de valor
6. Footer SAP | BBVA

Para ajustar el diseño del cromo, modificar únicamente la función `buildPrompt()` en `src/server/engine/geminiClient.ts`.

---

## Diseño UI

La interfaz sigue el **design system de BBVA**:
- Color principal: `#004481` (azul BBVA)
- Fondo: `#F4F6F9` (gris claro)
- Cards blancas con bordes suaves
- Tipografía: Inter

Para cambiar colores de la UI, editar `src/client/index.css` y los componentes en `src/client/components/`.

---

## Selectores del formulario

Los valores de cada selector están definidos en `src/client/components/RoleSelectors.tsx` (constante `ROLE_DATA`). Para añadir roles o habilidades, modificar ese objeto.

Los mensajes de valor que aparecen en el cromo se construyen en `geminiClient.ts`:
- Mensaje 1: `${role} — ${skill}`
- Mensaje 2: `Estilo: ${leadershipStyle}`
- Mensaje 3: `SAP AI Core · Executive Card`

Para personalizarlos, cambiar la función `buildPrompt()`.
