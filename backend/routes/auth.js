const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

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
      user: { id: user._id.toString(), email: user.email, name: user.name, avatar: user.avatar, visibility: user.visibility || 'visible' },
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
      user: { id: user._id.toString(), email: user.email, name: user.name, avatar: user.avatar, visibility: user.visibility || 'visible' },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;
