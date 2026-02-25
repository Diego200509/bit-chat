require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
