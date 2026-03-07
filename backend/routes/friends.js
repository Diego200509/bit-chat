const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { User, Friendship } = require('../models');

const router = express.Router();
router.use(authMiddleware);

router.post('/request', async (req, res) => {
  try {
    const { addresseeId } = req.body || {};
    if (!addresseeId || addresseeId === req.userId) {
      return res.status(400).json({ error: 'addresseeId inválido' });
    }
    const exists = await Friendship.findOne({
      $or: [
        { requester: req.userId, addressee: addresseeId },
        { requester: addresseeId, addressee: req.userId },
      ],
    });
    if (exists) {
      if (exists.status === 'accepted') return res.status(409).json({ error: 'Ya son amigos' });
      if (exists.requester.toString() === req.userId && exists.status === 'pending') {
        return res.status(409).json({ error: 'Ya enviaste una solicitud' });
      }
      if (exists.addressee.toString() === req.userId) {
        return res.status(409).json({ error: 'Esa persona ya te envió una solicitud. Acéptala desde solicitudes.' });
      }
    }
    const doc = await Friendship.findOneAndUpdate(
      { requester: req.userId, addressee: addresseeId },
      { $setOnInsert: { requester: req.userId, addressee: addresseeId, status: 'pending' } },
      { upsert: true, returnDocument: 'after' }
    );
    const addressee = await User.findById(addresseeId).select('name').lean();
    return res.status(201).json({
      id: doc._id.toString(),
      addresseeId,
      addresseeName: addressee?.name,
      status: doc.status,
    });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

router.get('/', async (req, res) => {
  try {
    const [asRequester, asAddressee] = await Promise.all([
      Friendship.find({ requester: req.userId }).populate('addressee', 'name email avatar').lean(),
      Friendship.find({ addressee: req.userId }).populate('requester', 'name email avatar').lean(),
    ]);
    const friends = [];
    const sent = [];
    const received = [];
    asRequester.forEach((f) => {
      const other = f.addressee;
      const item = { id: f._id.toString(), status: f.status, userId: other?._id?.toString(), name: other?.name, email: other?.email, avatar: other?.avatar };
      if (f.status === 'accepted') friends.push(item);
      else if (f.status === 'pending') sent.push(item);
    });
    asAddressee.forEach((f) => {
      const other = f.requester;
      const item = { id: f._id.toString(), status: f.status, userId: other?._id?.toString(), name: other?.name, email: other?.email, avatar: other?.avatar };
      if (f.status === 'accepted') friends.push(item);
      else if (f.status === 'pending') received.push(item);
    });
    return res.json({ friends, sent, received });
  } catch (err) {
    console.error('List friends error:', err);
    res.status(500).json({ error: 'Error al listar' });
  }
});

router.patch('/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};
    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({ error: 'action debe ser accept o reject' });
    }
    const doc = await Friendship.findOne({ _id: id, addressee: req.userId, status: 'pending' });
    if (!doc) return res.status(404).json({ error: 'Solicitud no encontrada' });
    doc.status = action === 'accept' ? 'accepted' : 'rejected';
    await doc.save();
    return res.json({ id: doc._id.toString(), status: doc.status });
  } catch (err) {
    console.error('Accept/reject request error:', err);
    res.status(500).json({ error: 'Error al procesar' });
  }
});

module.exports = router;
