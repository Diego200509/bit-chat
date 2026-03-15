const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const tokenBlacklist = require('../lib/tokenBlacklist');

async function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('No token'));
  }
  if (tokenBlacklist.has(token)) {
    return next(new Error('Token revocado'));
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId).select('name nickname avatar').lean();
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.data.userId = user._id.toString();
    socket.data.userName = (user.nickname && user.nickname.trim()) ? user.nickname.trim() : user.name;
    socket.data.userAvatar = user.avatar || null;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

module.exports = { authMiddleware };
