const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const app = require('./app');
const { attachSocket } = require('./socket');
const { connectDb } = require('./db/connect');

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: config.cors.origin },
});

attachSocket(io);
app.set('io', io);

connectDb()
  .then(() => {
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`BitChat backend en http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar el servidor:', err);
    process.exit(1);
  });
