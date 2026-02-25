const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'bitchat-backend' });
});

app.use('/auth', authRoutes);

module.exports = app;
