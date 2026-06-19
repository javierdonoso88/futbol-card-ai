import express from 'express';
import { generateCard } from '../engine/geminiClient';
import type { GenerateRequestBody } from '../engine/types';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { imageBase64, mimeType, role, skill, leadershipStyle } = req.body as GenerateRequestBody;

  if (!imageBase64 || !role || !skill || !leadershipStyle) {
    return res.status(400).json({ error: 'Faltan campos: imageBase64, role, skill, leadershipStyle' });
  }
  if (!['CFO', 'CTO', 'COO', 'CEO'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido. Debe ser CFO, CTO, COO o CEO' });
  }

  try {
    const result = await generateCard({
      imageBase64,
      mimeType: mimeType ?? 'image/jpeg',
      role,
      skill,
      leadershipStyle,
    });
    return res.json(result);
  } catch (err: unknown) {
    console.error('Error generando cromo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ error: message });
  }
});

export default router;
