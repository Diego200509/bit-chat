const config = require('../config');

let transporter = null;
if (config.email.smtpHost && config.email.smtpUser && config.email.smtpPass) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.secure,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPass,
    },
  });
}

/**
 * Envía un correo de recuperación de contraseña.
 * Si no hay SMTP configurado, imprime el enlace en consola (desarrollo).
 * @param {string} to - Email del destinatario
 * @param {string} resetLink - URL para restablecer contraseña
 * @param {string} [userName] - Nombre del usuario (opcional)
 */
async function sendPasswordResetEmail(to, resetLink, userName) {
  const subject = 'Recuperar contraseña - TalkApp';
  const text = `Hola${userName ? ` ${userName}` : ''},\n\nRecibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace (válido 1 hora):\n\n${resetLink}\n\nSi no solicitaste esto, ignora este correo.\n\n— TalkApp`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:500px;"><p>Hola${userName ? ` ${userName}` : ''},</p><p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace (válido 1 hora):</p><p><a href="${resetLink}" style="color:#7c3aed;">Restablecer contraseña</a></p><p>Si no solicitaste esto, ignora este correo.</p><p>— TalkApp</p></body></html>`;

  if (transporter) {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html,
    });
  } else {
    console.log('[TalkApp] No SMTP configurado. Enlace de recuperación (desarrollo):');
    console.log(resetLink);
    console.log('---');
  }
}

module.exports = { sendPasswordResetEmail };
