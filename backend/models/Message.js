const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderIdFallback: { type: String, default: null }, // cuando sender es null (ej. id de cliente)
    senderName: { type: String, default: null },
    text: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'sticker', 'emoji'], default: 'text' },
    imageUrl: { type: String, default: null },
    stickerUrl: { type: String, default: null },
    editedAt: { type: Date, default: null },
    readBy: [{ type: mongoose.Schema.Types.Mixed }], // ObjectId o string (para usuarios sin ObjectId)
    reactions: [reactionSchema],
    pinned: { type: Boolean, default: false },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Usuarios que han borrado este mensaje "para mí" (soft delete local) */
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** Si está definido, mensaje borrado "para todos" (soft delete global) */
    deletedAt: { type: Date, default: null },
    /** Quién eliminó el mensaje para todos (normalmente el autor) */
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
