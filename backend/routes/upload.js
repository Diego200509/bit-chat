const path = require('path');
const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    const fs = require('fs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').slice(0, 8).replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Solo imágenes (jpeg, png, gif, webp) permitidas'));
  },
});

router.use(authMiddleware);

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Archivo demasiado grande (máx. 10 MB)' });
  }
  res.status(400).json({ error: err.message || 'Error al subir' });
});

module.exports = router;
