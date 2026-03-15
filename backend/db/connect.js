const mongoose = require('mongoose');
const config = require('../config');

async function connectDb() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('TalkApp · Base de datos lista');
  } catch (err) {
    console.error('Error conectando a MongoDB:', err.message);
    throw err;
  }
}

module.exports = { connectDb };