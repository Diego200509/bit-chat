const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { editMessage, pinMessage, unpinMessage, deleteMessageForMe, deleteMessageForEveryone } = require('../services/chatService');

const router = express.Router();
router.use(authMiddleware);

/** PATCH /messages/:id - Editar mensaje (solo autor, solo tipo text). Body: { text } */
router.patch('/:id', async (req, res) => {
  try {
    const updated = await editMessage(req.params.id, req.userId, req.body?.text ?? '');
    if (!updated) return res.status(404).json({ error: 'No se puede editar el mensaje' });
    return res.json(updated);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Error al editar' });
  }
});

/** POST /messages/:id/pin - Fijar mensaje. Devuelve { pinned, unpinned? } */
router.post('/:id/pin', async (req, res) => {
  try {
    const result = await pinMessage(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Mensaje no encontrado' });
    return res.json(result);
  } catch (err) {
    console.error('Pin message error:', err);
    res.status(500).json({ error: 'Error al fijar' });
  }
});

/** POST /messages/:id/unpin - Desfijar mensaje */
router.post('/:id/unpin', async (req, res) => {
  try {
    const updated = await unpinMessage(req.params.id, req.userId);
    if (!updated) return res.status(404).json({ error: 'Mensaje no encontrado' });
    return res.json(updated);
  } catch (err) {
    console.error('Unpin message error:', err);
    res.status(500).json({ error: 'Error al desfijar' });
  }
});

/** DELETE /messages/:id - Eliminar mensaje. Body: { scope: 'for_me' | 'for_everyone' } */
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
