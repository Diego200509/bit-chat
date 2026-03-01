const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { User } = require('../models');

const router = express.Router();
router.use(authMiddleware);

/** GET /users/blocked - Lista de ids de usuarios que yo he bloqueado */
router.get('/blocked', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('blockedUsers').lean();
    const blockedUserIds = (user?.blockedUsers || []).map((b) => b.toString());
    return res.json(blockedUserIds);
  } catch (err) {
    console.error('Get blocked error:', err);
    res.status(500).json({ error: 'Error al cargar' });
  }
});

/** GET /users/search?q=... - Buscar usuarios por nombre o email (excluye yo y bloqueados) */
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }
    const me = req.userId;
    const meDoc = await User.findById(me).select('blockedUsers').lean();
    const blocked = meDoc?.blockedUsers?.map((b) => b.toString()) || [];
    const searchRegex = new RegExp(q, 'i');
    const users = await User.find({
      _id: { $ne: me, $nin: blocked },
      $or: [{ name: searchRegex }, { email: searchRegex }],
    })
      .select('_id name email avatar')
      .limit(20)
      .lean();
    return res.json(
      users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        avatar: u.avatar,
      }))
    );
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Error al buscar' });
  }
});

/** POST /users/block - Bloquear usuario. Body: { userId } */
router.post('/block', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId || userId === req.userId) {
      return res.status(400).json({ error: 'userId inválido' });
    }
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { blockedUsers: userId },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Error al bloquear' });
  }
});

/** DELETE /users/block/:userId - Desbloquear */
router.delete('/block/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(req.userId, {
      $pull: { blockedUsers: userId },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Error al desbloquear' });
  }
});

module.exports = router;
