const { registerSocketHandlers } = require('./handlers');

/**
 * Inicializa Socket.io y registra los manejadores de eventos.
 * @param {import('socket.io').Server} io
 */
function attachSocket(io) {
  registerSocketHandlers(io);
}

module.exports = { attachSocket };
