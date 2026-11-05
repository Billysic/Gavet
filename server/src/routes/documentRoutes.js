import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  analyzeDocument,
  syncDocuments,
  listDocuments,
  removeDocument
} from '../controllers/documentController.js';

const router = Router();

// Proteção global: todas as operações de documentos exigem autenticação
router.use(requireAuth);

// Rate limiter específico para chamadas de IA do Gemini (máximo 10 requisições por minuto)
const ocrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Muitas requisições de análise de imagem. Aguarde um momento antes de tentar novamente.'
  }
});

// Configuração do multer com armazenamento em memória (otimizado para streaming direto para o Gemini)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10 MB por foto/PDF
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado. Envie imagens (JPG, PNG, WebP) ou PDF.'));
    }
  }
});

// Endpoint principal de OCR e extração com Gemini (protegido por autenticação e rate limiting)
router.post('/analyze', ocrLimiter, upload.single('file'), analyzeDocument);

// Endpoints de sincronização offline-first e persistência isolada por usuário
router.post('/sync', syncDocuments);
router.get('/', listDocuments);
router.delete('/:id', removeDocument);

export default router;
