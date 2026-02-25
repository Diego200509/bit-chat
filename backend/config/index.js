require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/bitchat',
  jwtSecret: process.env.JWT_SECRET || 'bitchat-dev-secret-cambiar-en-produccion',
};
