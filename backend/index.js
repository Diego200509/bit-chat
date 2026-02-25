require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

/** Usuarios conectados: socketId -> { userId, userName } */
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  /** El cliente se identifica con su usuario (ej. tras "login" o nombre elegido) */
  socket.on('set_user', ({ userId, userName }) => {
    socket.data.userId = userId;
    socket.data.userName = userName || 'Anónimo';
    connectedUsers.set(socket.id, { userId, userName: socket.data.userName });
    io.emit('users_online', Array.from(connectedUsers.values()));
  });

  /** Entrar en una sala de chat (para recibir solo mensajes de ese chat) */
  socket.on('join_chat', (chatId) => {
    socket.join(`chat:${chatId}`);
  });

  /** Salir de una sala */
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat:${chatId}`);
  });

  /** Enviar mensaje: se reenvía a todos los que estén en esa sala (o a todos si no usamos salas) */
  socket.on('send_message', (payload) => {
    const { chatId, text, senderId, senderName } = payload;
    const userId = socket.data.userId || senderId;
    const userName = socket.data.userName || senderName || 'Anónimo';
    const message = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      chatId,
      text,
      senderId: userId,
      senderName: userName,
      timestamp: Date.now(),
    };
    io.to(`chat:${chatId}`).emit('new_message', message);
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    io.emit('users_online', Array.from(connectedUsers.values()));
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`BitChat backend en http://localhost:${PORT}`);
});
