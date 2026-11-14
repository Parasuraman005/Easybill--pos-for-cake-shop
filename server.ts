import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app.ts';

async function startServer() {
  const app = createApiApp();

  // Vite Dev Middleware or Production Static Files
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Easy Bill server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Easy Bill server:', err);
  process.exit(1);
});
