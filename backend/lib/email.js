const config = require('../config');

function escapeHtml(str) {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function buildPasswordResetHtml(resetLink, userName) {
  const trimmed = userName && String(userName).trim() ? String(userName).trim() : '';
  const displayName = trimmed ? escapeHtml(trimmed) : '';
  const hola = displayName ? `Hola ${displayName},` : 'Hola,';
  const minutes = config.resetPassword?.expiresMinutes ?? 60;
  const hrefAttr = escapeAttr(resetLink);
  const linkAsText = escapeHtml(resetLink);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recuperar contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#f0f0f3;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:520px;">
          <tr>
            <td style="padding:0 0 20px 0;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#5b21b6;letter-spacing:-0.02em;">TalkApp</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:28px 24px 24px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e4e4e7;">
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:#18181b;line-height:1.3;">Recuperar contraseña</h1>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#52525b;">${hola}</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#52525b;">Recibimos una solicitud para restablecer tu contraseña. Usa el botón de abajo. El enlace caduca en aproximadamente <strong style="color:#3f3f46;">${minutes} minutos</strong>.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 24px auto;">
                <tr>
                  <td style="border-radius:8px;background-color:#7c3aed;">
                    <a href="${hrefAttr}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Restablecer contraseña</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#71717a;">Si el botón no funciona, copia y pega este enlace en el navegador:</p>
              <p style="margin:0 0 20px 0;font-size:12px;line-height:1.45;color:#7c3aed;word-break:break-all;">${linkAsText}</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#71717a;">Si no solicitaste esto, puedes ignorar este correo con tranquilidad.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0 8px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">TalkApp · Mensaje automático, no respondas a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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

async function sendPasswordResetEmail(to, resetLink, userName) {
  const minutes = config.resetPassword?.expiresMinutes ?? 60;
  const subject = 'Recuperar contraseña - TalkApp';
  const greet = userName && String(userName).trim() ? `Hola ${String(userName).trim()},` : 'Hola,';
  const text = `${greet}\n\nRecibimos una solicitud para restablecer tu contraseña. Abre este enlace (caduca en unos ${minutes} minutos):\n\n${resetLink}\n\nSi no solicitaste esto, ignora este correo.\n\n— TalkApp`;
  const html = buildPasswordResetHtml(resetLink, userName);

  if (config.email.resendApiKey) {
    const { Resend } = require('resend');
    const resend = new Resend(config.email.resendApiKey);
    const { error } = await resend.emails.send({
      from: config.email.from,
      to: [to],
      subject,
      text,
      html,
    });
    if (error) {
      console.error('[TalkApp] Resend error:', error);
      throw new Error(error.message || 'Error al enviar correo');
    }
    return;
  }

  if (transporter) {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html,
    });
    return;
  }

  console.log('[TalkApp] Sin Resend ni SMTP. Enlace de recuperación (desarrollo):');
  console.log(resetLink);
  console.log('---');
}

module.exports = { sendPasswordResetEmail };
