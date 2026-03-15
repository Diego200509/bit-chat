const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderIdFallback: { type: String, default: null },
    senderName: { type: String, default: null },
    text: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'sticker', 'emoji', 'document', 'voice'], default: 'text' },
    imageUrl: { type: String, default: null },
    stickerUrl: { type: String, default: null },
    documentUrl: { type: String, default: null },
    voiceUrl: { type: String, default: null },
    editedAt: { type: Date, default: null },
    deliveredBy: [{ type: mongoose.Schema.Types.Mixed }],
    readBy: [{ type: mongoose.Schema.Types.Mixed }],
    reactions: [reactionSchema],
    pinned: { type: Boolean, default: false },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkPreview: {
      url: { type: String, default: null },
      title: { type: String, default: null },
      description: { type: String, default: null },
      imageUrl: { type: String, default: null },
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
