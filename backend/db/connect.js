const mongoose = require('mongoose');
const config = require('../config');

/**
 * Conecta a MongoDB. Llamar antes de levantar el servidor HTTP.
 */
async function connectDb() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB conectado:', config.mongoUri);
  } catch (err) {
    console.error('Error conectando a MongoDB:', err.message);
    throw err;
  }
}

module.exports = { connectDb };