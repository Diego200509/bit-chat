const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], default: 'direct', required: true },
    name: { type: String, trim: true, default: null },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    image: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** En grupos: usuarios que pueden añadir/eliminar participantes. Si está vacío, se considera admin a createdBy. */
    adminIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** En grupos: usuarios eliminados por un admin. Siguen viendo el chat pero no pueden escribir hasta que un admin los reincorpore. */
    removedParticipantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** Fecha en que cada usuario fue eliminado (solo grupos). Clave = userId string, valor = Date. Para filtrar historial. */
    removedAt: { type: Map, of: Date, default: null },
    /** Fecha en que cada usuario fue reincorporado (solo grupos). Clave = userId string, valor = Date. Mensajes entre removedAt y reIncorporatedAt no se muestran al usuario. */
    reIncorporatedAt: { type: Map, of: Date, default: null },
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    chatBackground: { type: String, default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, type: 1 });

module.exports = mongoose.model('Conversation', conversationSchema, 'conversations');
