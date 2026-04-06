const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { User } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const tokenBlacklist = require('../lib/tokenBlacklist');
const { sendPasswordResetEmail } = require('../lib/email');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const emailStr = typeof email === 'string' ? email.trim() : '';
    const passwordStr = typeof password === 'string' ? password : '';
    const nameStr = typeof name === 'string' ? name.trim() : '';
    if (!emailStr || !passwordStr || !nameStr) {
      return res.status(400).json({ error: 'Faltan email, password o name' });
    }
    if (passwordStr.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const existing = await User.findOne({ email: emailStr.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    const user = await User.create({
      email: emailStr.toLowerCase(),
      password: passwordStr,
      name: nameStr,
    });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name, avatar: user.avatar, nickname: user.nickname, status: user.status },
    });
  } catch (err) {
    console.error('Register error:', err);
    const message = err.message || 'Error al registrar';
    res.status(500).json({ error: message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan email o password' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name, avatar: user.avatar, nickname: user.nickname, status: user.status },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  try {
    if (req.token) tokenBlacklist.add(req.token);
    res.status(200).json({ message: 'Sesión cerrada' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!emailStr) {
      return res.status(400).json({ error: 'Indica tu email' });
    }
    const user = await User.findOne({ email: emailStr });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + config.resetPassword.expiresMinutes * 60 * 1000);
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = expires;
      await user.save({ validateBeforeSave: false });
      const resetLink = `${config.resetPassword.frontendBaseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetLink, user.name);
    }
    res.json({ message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const tokenStr = typeof token === 'string' ? token.trim() : '';
    const passwordStr = typeof newPassword === 'string' ? newPassword : '';
    if (!tokenStr || !passwordStr) {
      return res.status(400).json({ error: 'Faltan el token o la nueva contraseña' });
    }
    if (passwordStr.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hashedToken = crypto.createHash('sha256').update(tokenStr).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires +password');
    if (!user) {
      return res.status(400).json({ error: 'Enlace inválido o expirado. Solicita uno nuevo.' });
    }
    const sameAsCurrent = await user.comparePassword(passwordStr);
    if (sameAsCurrent) {
      return res.status(400).json({
        error: 'La nueva contraseña no puede ser la misma que la anterior. Elige otra distinta.',
      });
    }
    user.password = passwordStr;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

module.exports = router;
