import { Router } from 'express';
import multer from 'multer';
import {
  analyzeDocument,
  syncDocuments,
  listDocuments,
  removeDocument
} from '../controllers/documentController.js';

const router = Router();

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

// Endpoint principal de OCR e extração com Gemini
router.post('/analyze', upload.single('file'), analyzeDocument);

// Endpoints de sincronização offline-first e persistência no SQLite
router.post('/sync', syncDocuments);
router.get('/', listDocuments);
router.delete('/:id', removeDocument);

export default router;
