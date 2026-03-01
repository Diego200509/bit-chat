const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const friendsRoutes = require('./routes/friends');
const chatsRoutes = require('./routes/chats');

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'bitchat-backend' });
});

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/friends', friendsRoutes);
app.use('/chats', chatsRoutes);

module.exports = app;
