import express from 'express';
import cors from 'cors';
import path from 'path';
import generateRouter from './routes/generate';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use('/api', generateRouter);

if (isProd) {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Fútbol Card AI server running on port ${PORT}`);
  if (isProd) console.log('Serving client from dist/client/');
});

export default app;
