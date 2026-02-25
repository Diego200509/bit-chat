const { registerSocketHandlers } = require('./handlers');
const { authMiddleware } = require('./middleware');

/**
 * Inicializa Socket.io: middleware de auth (JWT) y manejadores.
 * @param {import('socket.io').Server} io
 */
function attachSocket(io) {
  io.use(authMiddleware);
  registerSocketHandlers(io);
}

module.exports = { attachSocket };
