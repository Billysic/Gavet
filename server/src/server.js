import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import documentRoutes from './routes/documentRoutes.js';
import { getDatabase } from './config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares essenciais
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Inicialização do Banco SQLite
await getDatabase();

// Rotas da API
app.use('/api/documents', documentRoutes);

// Healthcheck (ótimo para monitoramento no Render)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    app: 'Gaveta Inteligente API',
    timestamp: new Date().toISOString()
  });
});

// Suporte a Produção / Render: Serve os arquivos estáticos do front-end construído (client/dist)
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Inicialização do Servidor HTTP
app.listen(PORT, () => {
  console.log(`🚀 Servidor da Gaveta Inteligente rodando na porta ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`✨ OCR Gemini Endpoint: http://localhost:${PORT}/api/documents/analyze`);
});
