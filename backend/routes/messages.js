const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { deleteMessageForMe, deleteMessageForEveryone } = require('../services/conversationService');

const router = express.Router();
router.use(authMiddleware);

router.delete('/:id', async (req, res) => {
  try {
    const scope = (req.body?.scope || req.query?.scope || 'for_me') === 'for_everyone' ? 'for_everyone' : 'for_me';
    const fn = scope === 'for_everyone' ? deleteMessageForEveryone : deleteMessageForMe;
    const result = await fn(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'No se puede eliminar el mensaje' });
    return res.json(result);
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
