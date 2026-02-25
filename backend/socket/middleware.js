const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

/**
 * Middleware de Socket.io: verifica JWT en handshake.auth.token
 * y asigna socket.data.userId y socket.data.userName (desde la DB).
 * Sin token válido la conexión se rechaza.
 */
async function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('No token'));
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId).select('name');
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.data.userId = user._id.toString();
    socket.data.userName = user.name;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

module.exports = { authMiddleware };
