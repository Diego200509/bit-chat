const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { User } = require('../models');

const router = express.Router();
router.use(authMiddleware);

router.patch('/me', async (req, res) => {
  try {
    const body = req.body || {};
    const update = {};
    if (Object.prototype.hasOwnProperty.call(body, 'nickname')) {
      update.nickname = typeof body.nickname === 'string' ? (body.nickname.trim() || null) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
      update.avatar = typeof body.avatar === 'string' ? (body.avatar.trim() || null) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'visibility')) {
      const v = body.visibility;
      update.visibility = v === 'invisible' || v === 'visible' ? v : 'visible';
    }
    if (Object.keys(update).length === 0) return res.json({ ok: true });
    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { returnDocument: 'after' })
      .select('name email nickname avatar visibility')
      .lean();
    return res.json({
      id: user._id.toString(),
      name: user.name,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatar,
      visibility: user.visibility,
    });
  } catch (err) {
    console.error('Update me error:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

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
