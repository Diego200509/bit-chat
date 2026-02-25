const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6, select: false },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: null },
    nickname: { type: String, trim: true, default: null },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    visibility: { type: String, enum: ['visible', 'invisible'], default: 'visible' },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (typeof this.password !== 'string' || this.password.length < 6) {
    throw new Error('Password must be a string of at least 6 characters');
  }
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(String(candidate), this.password);
};

module.exports = mongoose.model('User', userSchema);
