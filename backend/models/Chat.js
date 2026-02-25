const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], default: 'direct', required: true },
    name: { type: String, trim: true, default: null },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    image: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    chatBackground: { type: String, default: null },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1, type: 1 });

module.exports = mongoose.model('Chat', chatSchema);
