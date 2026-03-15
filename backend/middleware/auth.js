const jwt = require('jsonwebtoken');
const config = require('../config');
const tokenBlacklist = require('../lib/tokenBlacklist');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token revocado' });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { authMiddleware };
