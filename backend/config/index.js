require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/talkapp',
  jwtSecret: process.env.JWT_SECRET || process.env.TALKAPP_JWT_SECRET || 'talkapp-dev-secret-cambiar-en-produccion',
  resetPassword: {
    expiresMinutes: Number(process.env.RESET_PASSWORD_EXPIRES_MINUTES) || 60,
    frontendBaseUrl: process.env.FRONTEND_URL || process.env.RESET_LINK_BASE || 'http://localhost:5173',
  },
  email: {
    from: process.env.EMAIL_FROM || 'TalkApp <noreply@talkapp.local>',
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE === 'true',
  },
};
