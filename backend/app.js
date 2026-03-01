const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const friendsRoutes = require('./routes/friends');
const chatsRoutes = require('./routes/chats');
const messagesRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'bitchat-backend' });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/stickers', (req, res, next) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  next();
}, express.static(path.join(__dirname, 'stickers')));
app.use('/upload', uploadRoutes);
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/friends', friendsRoutes);
app.use('/chats', chatsRoutes);
app.use('/messages', messagesRoutes);

module.exports = app;
