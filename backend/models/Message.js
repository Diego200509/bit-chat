const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, default: null },
    text: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'sticker', 'emoji'], default: 'text' },
    imageUrl: { type: String, default: null },
    stickerUrl: { type: String, default: null },
    editedAt: { type: Date, default: null },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [reactionSchema],
    pinned: { type: Boolean, default: false },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
