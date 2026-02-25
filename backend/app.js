const express = require('express');
const cors = require('cors');
const config = require('./config');

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// Rutas REST (para más adelante: health, api de chats, etc.)
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'bitchat-backend' });
});

module.exports = app;
