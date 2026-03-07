const { registerSocketHandlers } = require('./handlers');
const { authMiddleware } = require('./middleware');

function attachSocket(io) {
  io.use(authMiddleware);
  registerSocketHandlers(io);
}

module.exports = { attachSocket };
