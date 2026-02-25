const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const app = require('./app');
const { attachSocket } = require('./socket');

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: config.cors.origin },
});

attachSocket(io);

server.listen(config.port, () => {
  console.log(`BitChat backend en http://localhost:${config.port}`);
});
