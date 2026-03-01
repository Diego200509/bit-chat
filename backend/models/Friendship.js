const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addressee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      required: true,
    },
  },
  { timestamps: true }
);

friendshipSchema.index({ requester: 1, addressee: 1 }, { unique: true });
friendshipSchema.index({ addressee: 1, status: 1 });

module.exports = mongoose.model('Friendship', friendshipSchema);
