const mongoose = require('mongoose');
const { Conversation, Message, User } = require('../models');
const { extractFirstUrl, fetchLinkPreview } = require('../lib/linkPreview');

async function getOrCreateConversation(conversationId) {
  if (mongoose.Types.ObjectId.isValid(conversationId) && new mongoose.Types.ObjectId(conversationId).toString() === conversationId) {
    const conv = await Conversation.findById(conversationId);
    return conv;
  }
  if (conversationId === 'chat-1' || conversationId === 'general') {
    let conv = await Conversation.findOne({ name: 'General', type: 'group' });
    if (!conv) {
      conv = await Conversation.create({ name: 'General', type: 'group', participants: [] });
    }
    return conv;
  }
  return null;
}

async function saveMessage(conversationId, senderId, senderName, opts = {}) {
  const text = typeof opts === 'string' ? opts : (opts.text ?? '');
  const type = (typeof opts === 'object' && opts.type) || 'text';
  const imageUrl = (typeof opts === 'object' && opts.imageUrl) || null;
  const stickerUrl = (typeof opts === 'object' && opts.stickerUrl) || null;
  const documentUrl = (typeof opts === 'object' && opts.documentUrl) || null;
  const voiceUrl = (typeof opts === 'object' && opts.voiceUrl) || null;

  const conv = await getOrCreateConversation(conversationId);
  if (!conv) return null;

  if (conv.type === 'group') {
    const removed = (conv.removedParticipantIds || []).map((id) => id.toString());
    if (removed.includes(senderId.toString())) return null;
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(senderId) && new mongoose.Types.ObjectId(senderId).toString() === senderId;
  let senderObjectId = null;
  let name = senderName || 'Anónimo';
  let senderAvatar = null;
  if (isObjectId) {
    const user = await User.findById(senderId).select('name nickname avatar').lean();
    if (user) {
      senderObjectId = user._id;
      name = user.nickname?.trim() || user.name;
      senderAvatar = user.avatar || null;
    }
  }

  const msg = await Message.create({
    conversation: conv._id,
    sender: senderObjectId || null,
    senderIdFallback: senderObjectId ? null : String(senderId),
    senderName: senderObjectId ? null : name,
    text: text || '',
    type: ['text', 'image', 'sticker', 'emoji', 'document', 'voice'].includes(type) ? type : 'text',
    imageUrl: type === 'image' ? imageUrl : null,
    stickerUrl: type === 'sticker' ? stickerUrl : null,
    documentUrl: type === 'document' ? documentUrl : null,
    voiceUrl: type === 'voice' ? voiceUrl : null,
  });

  const resolvedChatId = (conversationId === 'chat-1' || conversationId === 'general') ? conversationId : conv._id.toString();
  return messageToPayload(msg, resolvedChatId, name, null, senderAvatar);
}

function getRemovedAt(removedAt, userId) {
  if (!removedAt) return null;
  return typeof removedAt.get === 'function' ? removedAt.get(userId) : removedAt[userId];
}

function messageToPayload(msg, resolvedChatId, senderDisplayName, senderIdFallback = null, senderAvatar = null, removedAt = null) {
  let senderId = null;
  if (msg.sender) {
    senderId = typeof msg.sender === 'object' && msg.sender._id != null
      ? msg.sender._id.toString()
      : msg.sender.toString();
  } else {
    senderId = msg.senderIdFallback ?? senderIdFallback ?? null;
  }
  const type = (msg.type && ['text', 'image', 'sticker', 'emoji', 'document', 'voice'].includes(msg.type)) ? msg.type : 'text';
  const stickerUrl = msg.stickerUrl != null && String(msg.stickerUrl).trim() ? String(msg.stickerUrl).trim() : null;
  const imageUrl = msg.imageUrl != null && String(msg.imageUrl).trim() ? String(msg.imageUrl).trim() : null;
  const documentUrl = msg.documentUrl != null && String(msg.documentUrl).trim() ? String(msg.documentUrl).trim() : null;
  const voiceUrl = msg.voiceUrl != null && String(msg.voiceUrl).trim() ? String(msg.voiceUrl).trim() : null;
  const avatar = senderAvatar ?? (msg.sender && msg.sender.avatar) ?? null;
  const linkPreview =
    msg.linkPreview && (msg.linkPreview.title || msg.linkPreview.description || msg.linkPreview.imageUrl)
      ? {
          url: msg.linkPreview.url || null,
          title: msg.linkPreview.title || null,
          description: msg.linkPreview.description || null,
          imageUrl: msg.linkPreview.imageUrl || null,
        }
      : null;
  let deliveredBy = (msg.deliveredBy || []).map((id) => id.toString());
  let readBy = (msg.readBy || []).map((id) => id.toString());
  if (removedAt) {
    const msgDate = msg.createdAt ? new Date(msg.createdAt) : null;
    deliveredBy = deliveredBy.filter((id) => {
      const at = getRemovedAt(removedAt, id);
      if (!at) return true;
      return msgDate && msgDate <= new Date(at);
    });
    readBy = readBy.filter((id) => {
      const at = getRemovedAt(removedAt, id);
      if (!at) return true;
      return msgDate && msgDate <= new Date(at);
    });
  }
  return {
    id: msg._id.toString(),
    chatId: resolvedChatId,
    text: msg.text || '',
    type,
    imageUrl,
    stickerUrl,
    documentUrl,
    voiceUrl,
    linkPreview,
    editedAt: msg.editedAt ? new Date(msg.editedAt).getTime() : null,
    deliveredBy,
    readBy,
    pinned: !!msg.pinned,
    reactions: (msg.reactions || []).map((r) => ({ userId: r.userId.toString(), emoji: r.emoji })),
    senderId,
    senderName: senderDisplayName ?? msg.senderName ?? 'Anónimo',
    senderAvatar: avatar && String(avatar).trim() ? String(avatar).trim() : null,
    timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
  };
}

function deletedMessageToPayload(msg, resolvedChatId, senderDisplayName) {
  const senderId = msg.sender
    ? (typeof msg.sender === 'object' && msg.sender._id != null ? msg.sender._id.toString() : msg.sender.toString())
    : (msg.senderIdFallback || null);
  const deletedByUserId = msg.deletedBy ? msg.deletedBy.toString() : senderId;
  return {
    id: msg._id.toString(),
    chatId: resolvedChatId,
    text: '',
    type: 'text',
    imageUrl: null,
    stickerUrl: null,
    documentUrl: null,
    voiceUrl: null,
    linkPreview: null,
    editedAt: null,
    deliveredBy: [],
    readBy: [],
    pinned: false,
    reactions: [],
    senderId,
    senderName: senderDisplayName ?? msg.senderName ?? 'Anónimo',
    senderAvatar: null,
    timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
    deletedForEveryone: true,
    deletedByUserId,
  };
}

async function getMessageHistory(conversationId, limit = 100, currentUserId = null) {
  const conv = await getOrCreateConversation(conversationId);
  if (!conv) return [];

  const resolvedChatId = (conversationId === 'chat-1' || conversationId === 'general') ? conversationId : conv._id.toString();

  let cutOffDate = null;
  if (conv.type === 'group' && currentUserId) {
    const removed = (conv.removedParticipantIds || []).map((id) => id.toString());
    if (removed.includes(String(currentUserId)) && conv.removedAt) {
      cutOffDate = (typeof conv.removedAt.get === 'function' ? conv.removedAt.get(currentUserId) : conv.removedAt[currentUserId]) || null;
    }
  }

  const baseQuery = { conversation: conv._id, deletedAt: null };
  if (currentUserId) {
    const userObjId = mongoose.Types.ObjectId.isValid(currentUserId) ? new mongoose.Types.ObjectId(currentUserId) : null;
    if (userObjId) baseQuery.deletedFor = { $nin: [userObjId] };
  }
  if (cutOffDate) baseQuery.createdAt = { $lte: cutOffDate };

  let messages = await Message.find(baseQuery)
    .sort({ createdAt: 1 })
    .limit(limit * 2)
    .populate('sender', 'name nickname avatar')
    .lean();

  const deletedQuery = { conversation: conv._id, deletedAt: { $ne: null } };
  if (cutOffDate) deletedQuery.createdAt = { $lte: cutOffDate };
  let deletedMessages = await Message.find(deletedQuery)
    .sort({ createdAt: 1 })
    .limit(limit * 2)
    .populate('sender', 'name nickname')
    .lean();

  let blockedIds = new Set();
  if (currentUserId) {
    const me = await User.findById(currentUserId).select('blockedUsers').lean();
    blockedIds = new Set((me?.blockedUsers || []).map((b) => b.toString()));
    messages = messages.filter((m) => {
      const senderId = m.sender?._id?.toString() || null;
      return !senderId || !blockedIds.has(senderId);
    });
    deletedMessages = deletedMessages.filter((m) => {
      const senderId = m.sender?._id?.toString() || m.sender?.toString() || null;
      return !senderId || !blockedIds.has(senderId);
    });
  }

  const getSenderName = (m) => (m.sender ? (m.sender.nickname?.trim() || m.sender.name) : (m.senderName || 'Anónimo'));
  const getSenderAvatar = (m) => (m.sender && m.sender.avatar ? m.sender.avatar : null);
  const removedAtForPayload = conv.type === 'group' ? conv.removedAt : null;

  const list1 = messages.map((m) => messageToPayload(m, resolvedChatId, getSenderName(m), null, getSenderAvatar(m), removedAtForPayload));
  const list2 = deletedMessages.map((m) => deletedMessageToPayload(m, resolvedChatId, getSenderName(m)));

  let combined = [...list1, ...list2].sort((a, b) => a.timestamp - b.timestamp).slice(-limit);
  combined.sort((a, b) => (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1) || (a.timestamp - b.timestamp));
  return combined;
}

async function getOrCreateDirectConversation(userId1, userId2) {
  const id1 = new mongoose.Types.ObjectId(userId1);
  const id2 = new mongoose.Types.ObjectId(userId2);
  let conv = await Conversation.findOne({
    type: 'direct',
    participants: { $all: [id1, id2], $size: 2 },
  });
  if (!conv) {
    conv = await Conversation.create({
      type: 'direct',
      participants: [id1, id2],
    });
  }
  return conv;
}

async function getConversationsForUser(userId, limit = 50) {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const list = [];

  const userObjIdForList = new mongoose.Types.ObjectId(userId);
  const lastMsgQueryBase = (convId) => ({
    conversation: convId,
    deletedAt: null,
    deletedFor: { $nin: [userObjIdForList] },
  });

  async function getUnreadCount(convId, maxCreatedAt = null) {
    const query = {
      conversation: convId,
      deletedAt: null,
      deletedFor: { $nin: [userObjIdForList] },
      sender: { $ne: userObjIdForList },
      readBy: { $nin: [userObjIdForList] },
    };
    if (maxCreatedAt) query.createdAt = { $lte: maxCreatedAt };
    const count = await Message.countDocuments(query);
    return count;
  }

  const general = await Conversation.findOne({ name: 'General', type: 'group' })
    .populate('participants', 'name nickname avatar')
    .lean();
  if (general) {
    const removedParticipantIdsGeneral = (general.removedParticipantIds || []).map((id) => id.toString());
    const isRemovedFromGroupGeneral = removedParticipantIdsGeneral.includes(userId);
    const generalLastMsgQuery = { ...lastMsgQueryBase(general._id) };
    let generalUnreadCutOff = null;
    if (isRemovedFromGroupGeneral && general.removedAt) {
      const cutOff = getRemovedAt(general.removedAt, userId);
      if (cutOff) {
        generalLastMsgQuery.createdAt = { $lte: new Date(cutOff) };
        generalUnreadCutOff = new Date(cutOff);
      }
    }
    const lastMsg = await Message.findOne(generalLastMsgQuery).sort({ createdAt: -1 }).lean();
    const pinned = (general.pinnedBy || []).some((id) => id.toString() === userId);
    const isMuted = (general.mutedBy || []).some((id) => id.toString() === userId);
    const participants = (general.participants || []).map((p) => ({
      id: p._id.toString(),
      name: (p.nickname && p.nickname.trim()) ? p.nickname.trim() : p.name,
    }));
    const adminIds = (general.adminIds && general.adminIds.length > 0)
      ? general.adminIds.map((id) => id.toString())
      : (general.createdBy ? [general.createdBy.toString()] : []);
    const isGroupAdmin = adminIds.includes(userId);
    const removedParticipantIds = removedParticipantIdsGeneral;
    const isRemovedFromGroup = isRemovedFromGroupGeneral;
    const lastMessageSenderId = lastMsg?.sender ? lastMsg.sender.toString() : (lastMsg?.senderIdFallback || null);
    let lastMessageReadBy = (lastMsg?.readBy || []).map((id) => (id && id.toString ? id.toString() : String(id)));
    let lastMessageDeliveredBy = (lastMsg?.deliveredBy || []).map((id) => (id && id.toString ? id.toString() : String(id)));
    if (general.removedAt && lastMsg?.createdAt) {
      const lastMsgDate = new Date(lastMsg.createdAt);
      lastMessageReadBy = lastMessageReadBy.filter((id) => {
        if (!removedParticipantIds.includes(id)) return true;
        const at = getRemovedAt(general.removedAt, id);
        return at && lastMsgDate <= new Date(at);
      });
      lastMessageDeliveredBy = lastMessageDeliveredBy.filter((id) => {
        if (!removedParticipantIds.includes(id)) return true;
        const at = getRemovedAt(general.removedAt, id);
        return at && lastMsgDate <= new Date(at);
      });
    } else {
      lastMessageReadBy = lastMessageReadBy.filter((id) => !removedParticipantIds.includes(id));
      lastMessageDeliveredBy = lastMessageDeliveredBy.filter((id) => !removedParticipantIds.includes(id));
    }
    const unread = await getUnreadCount(general._id, generalUnreadCutOff);
    list.push({
      id: 'chat-1',
      name: 'General',
      type: 'group',
      image: general.image,
      participants,
      adminIds,
      isGroupAdmin,
      isRemovedFromGroup,
      removedParticipantIds,
      isPinned: pinned,
      lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Imagen' : lastMsg?.type === 'sticker' ? 'Sticker' : lastMsg?.type === 'document' ? 'Documento' : lastMsg?.type === 'voice' ? 'Nota de voz' : ''),
      lastMessageTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : (general.updatedAt ? new Date(general.updatedAt).getTime() : null),
      lastMessageSenderId: lastMessageSenderId || undefined,
      lastMessageReadBy: lastMessageReadBy.length ? lastMessageReadBy : undefined,
      lastMessageDeliveredBy: lastMessageDeliveredBy.length ? lastMessageDeliveredBy : undefined,
      isMuted,
      unread,
    });
  }

  const directConvs = await Conversation.find({ type: 'direct', participants: userObjId })
    .populate('participants', 'name nickname avatar lastSeen status')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  for (const c of directConvs) {
    const other = c.participants?.find((p) => p._id.toString() !== userId);
    const displayName = other ? (other.nickname?.trim() || other.name) : 'Usuario';
    const lastMsg = await Message.findOne(lastMsgQueryBase(c._id)).sort({ createdAt: -1 }).lean();
    const pinned = (c.pinnedBy || []).some((id) => id.toString() === userId);
    const isMuted = (c.mutedBy || []).some((id) => id.toString() === userId);
    const otherUserLastSeen = other?.lastSeen ? new Date(other.lastSeen).getTime() : null;
    const lastMessageSenderId = lastMsg?.sender ? lastMsg.sender.toString() : (lastMsg?.senderIdFallback || null);
    const lastMessageReadBy = (lastMsg?.readBy || []).map((id) => (id && id.toString ? id.toString() : String(id)));
    const lastMessageDeliveredBy = (lastMsg?.deliveredBy || []).map((id) => (id && id.toString ? id.toString() : String(id)));
    const unread = await getUnreadCount(c._id);
    list.push({
      id: c._id.toString(),
      name: displayName,
      type: 'direct',
      otherUserId: other?._id?.toString(),
      avatar: other?.avatar || null,
      otherUserLastSeen: otherUserLastSeen || null,
      otherUserStatus: other?.status || null,
      isPinned: pinned,
      isMuted,
      lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Imagen' : lastMsg?.type === 'sticker' ? 'Sticker' : lastMsg?.type === 'document' ? 'Documento' : lastMsg?.type === 'voice' ? 'Nota de voz' : ''),
      lastMessageTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : new Date(c.updatedAt).getTime(),
      lastMessageSenderId: lastMessageSenderId || undefined,
      lastMessageReadBy: lastMessageReadBy.length ? lastMessageReadBy : undefined,
      lastMessageDeliveredBy: lastMessageDeliveredBy.length ? lastMessageDeliveredBy : undefined,
      unread,
    });
  }

  const groupConvs = await Conversation.find({ type: 'group', participants: userObjId, name: { $ne: 'General' } })
    .populate('participants', 'name nickname avatar')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  for (const c of groupConvs) {
    const removedParticipantIdsC = (c.removedParticipantIds || []).map((id) => id.toString());
    const isRemovedFromGroupC = removedParticipantIdsC.includes(userId);
    const groupLastMsgQuery = { ...lastMsgQueryBase(c._id) };
    let groupUnreadCutOff = null;
    if (isRemovedFromGroupC && c.removedAt) {
      const cutOff = getRemovedAt(c.removedAt, userId);
      if (cutOff) {
        groupLastMsgQuery.createdAt = { $lte: new Date(cutOff) };
        groupUnreadCutOff = new Date(cutOff);
      }
    }
    const lastMsg = await Message.findOne(groupLastMsgQuery).sort({ createdAt: -1 }).lean();
    const pinned = (c.pinnedBy || []).some((id) => id.toString() === userId);
    const isMuted = (c.mutedBy || []).some((id) => id.toString() === userId);
    const participants = (c.participants || []).map((p) => ({
      id: p._id.toString(),
      name: (p.nickname && p.nickname.trim()) ? p.nickname.trim() : p.name,
    }));
    const adminIds = (c.adminIds && c.adminIds.length > 0)
      ? c.adminIds.map((id) => id.toString())
      : (c.createdBy ? [c.createdBy.toString()] : []);
    const isGroupAdmin = adminIds.includes(userId);
    const removedParticipantIds = removedParticipantIdsC;
    const isRemovedFromGroup = isRemovedFromGroupC;
    const lastMessageSenderId = lastMsg?.sender ? lastMsg.sender.toString() : (lastMsg?.senderIdFallback || null);
    let lastMessageReadBy = (lastMsg?.readBy || []).map((id) => (id && id.toString ? id.toString() : String(id)));
    let lastMessageDeliveredBy = (lastMsg?.deliveredBy || []).map((id) => (id && id.toString ? id.toString() : String(id)));
    if (c.removedAt && lastMsg?.createdAt) {
      const lastMsgDate = new Date(lastMsg.createdAt);
      lastMessageReadBy = lastMessageReadBy.filter((id) => {
        if (!removedParticipantIds.includes(id)) return true;
        const at = getRemovedAt(c.removedAt, id);
        return at && lastMsgDate <= new Date(at);
      });
      lastMessageDeliveredBy = lastMessageDeliveredBy.filter((id) => {
        if (!removedParticipantIds.includes(id)) return true;
        const at = getRemovedAt(c.removedAt, id);
        return at && lastMsgDate <= new Date(at);
      });
    } else {
      lastMessageReadBy = lastMessageReadBy.filter((id) => !removedParticipantIds.includes(id));
      lastMessageDeliveredBy = lastMessageDeliveredBy.filter((id) => !removedParticipantIds.includes(id));
    }
    const unread = await getUnreadCount(c._id, groupUnreadCutOff);
    list.push({
      id: c._id.toString(),
      name: c.name || 'Grupo',
      type: 'group',
      image: c.image,
      participants,
      adminIds,
      isGroupAdmin,
      isRemovedFromGroup,
      removedParticipantIds,
      isPinned: pinned,
      isMuted,
      lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Imagen' : lastMsg?.type === 'sticker' ? 'Sticker' : lastMsg?.type === 'document' ? 'Documento' : lastMsg?.type === 'voice' ? 'Nota de voz' : ''),
      lastMessageTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : new Date(c.updatedAt).getTime(),
      lastMessageSenderId: lastMessageSenderId || undefined,
      lastMessageReadBy: lastMessageReadBy.length ? lastMessageReadBy : undefined,
      lastMessageDeliveredBy: lastMessageDeliveredBy.length ? lastMessageDeliveredBy : undefined,
      unread,
    });
  }

  list.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
  });
  return list;
}

async function createGroupConversation(creatorId, name, participantIds = [], image = null) {
  const creatorObjId = new mongoose.Types.ObjectId(creatorId);
  const allIds = [creatorObjId, ...participantIds.map((id) => new mongoose.Types.ObjectId(id))];
  const uniqueIds = [...new Set(allIds.map((id) => id.toString()))].map((id) => new mongoose.Types.ObjectId(id));
  const conv = await Conversation.create({
    type: 'group',
    name: name || 'Grupo',
    image: image || null,
    participants: uniqueIds,
    createdBy: creatorId,
    adminIds: [creatorObjId],
  });
  return conv;
}

async function toggleReaction(messageId, userId, emoji) {
  if (!messageId || !userId || !emoji || typeof emoji !== 'string') return null;
  const msg = await Message.findById(messageId);
  if (!msg) return null;
  const userObjId = new mongoose.Types.ObjectId(userId);
  const reactions = (msg.reactions || []).filter((r) => r.userId);
  const idx = reactions.findIndex((r) => r.userId.toString() === userId && r.emoji === emoji);
  if (idx >= 0) {
    reactions.splice(idx, 1);
  } else {
    reactions.push({ userId: userObjId, emoji: emoji.trim().slice(0, 32) });
  }
  msg.reactions = reactions;
  await msg.save();
  const resolvedChatId = msg.conversation.toString();
  let senderName = msg.senderName || 'Anónimo';
  let senderAvatar = null;
  if (msg.sender) {
    const u = await User.findById(msg.sender).select('name nickname avatar').lean();
    if (u) {
      senderName = u.nickname?.trim() || u.name;
      senderAvatar = u.avatar || null;
    }
  }
  return messageToPayload(msg, resolvedChatId, senderName, null, senderAvatar);
}

async function fetchAndAttachLinkPreview(messageId) {
  if (!messageId) return null;
  const msg = await Message.findById(messageId);
  if (!msg || msg.type !== 'text' || !msg.text || !extractFirstUrl(msg.text)) return null;
  if (msg.linkPreview && (msg.linkPreview.title || msg.linkPreview.description || msg.linkPreview.imageUrl)) return null;
  const url = extractFirstUrl(msg.text);
  const preview = await fetchLinkPreview(url);
  if (!preview || (!preview.title && !preview.description && !preview.imageUrl)) return null;
  await Message.findByIdAndUpdate(messageId, {
    linkPreview: {
      url: preview.url || url,
      title: preview.title || null,
      description: preview.description || null,
      imageUrl: preview.imageUrl || null,
    },
  });
  const updated = await Message.findById(messageId).populate('sender', 'name nickname avatar').lean();
  const conv = await Conversation.findById(updated.conversation).select('name type').lean();
  const resolved =
    conv && conv.name === 'General' && conv.type === 'group' ? 'chat-1' : updated.conversation.toString();
  const getSenderName = (m) => (m.sender ? (m.sender.nickname?.trim() || m.sender.name) : (m.senderName || 'Anónimo'));
  const getSenderAvatar = (m) => (m.sender && m.sender.avatar ? m.sender.avatar : null);
  return messageToPayload(updated, resolved, getSenderName(updated), null, getSenderAvatar(updated));
}

async function markMessageDelivered(messageId, userId) {
  if (!messageId || !userId) return null;
  const msg = await Message.findById(messageId);
  if (!msg) return null;
  const conv = await Conversation.findById(msg.conversation).select('name type removedParticipantIds removedAt').lean();
  if (conv?.type === 'group') {
    const removed = (conv.removedParticipantIds || []).map((id) => id.toString());
    if (removed.includes(String(userId))) return null;
  }
  const idStr = String(userId);
  const value =
    mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24
      ? new mongoose.Types.ObjectId(idStr)
      : idStr;
  if ((msg.deliveredBy || []).some((id) => id.toString() === idStr)) return null;
  await Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredBy: value } });
  const updated = await Message.findById(messageId).populate('sender', 'name nickname avatar').lean();
  const resolvedChatId =
    conv?.name === 'General' && conv?.type === 'group' ? 'chat-1' : msg.conversation.toString();
  const getSenderName = (m) => (m.sender ? (m.sender.nickname?.trim() || m.sender.name) : (m.senderName || 'Anónimo'));
  const getSenderAvatar = (m) => (m.sender && m.sender.avatar ? m.sender.avatar : null);
  const removedAt = conv?.type === 'group' ? conv.removedAt : null;
  return messageToPayload(updated, resolvedChatId, getSenderName(updated), null, getSenderAvatar(updated), removedAt);
}

async function markAllConversationsDeliveredForUser(userId) {
  if (!userId) return [];
  const userObjId = new mongoose.Types.ObjectId(userId);
  const convs = await Conversation.find({ participants: userObjId }).select('_id name type removedParticipantIds removedAt').lean();
  const payloads = [];
  for (const conv of convs) {
    if (conv.type === 'group') {
      const removed = (conv.removedParticipantIds || []).map((id) => id.toString());
      if (removed.includes(userId)) continue;
    }
    const resolvedChatId = (conv.name === 'General' && conv.type === 'group') ? 'chat-1' : conv._id.toString();
    const deliveredQuery = {
      conversation: conv._id,
      sender: { $ne: userObjId },
      deliveredBy: { $nin: [userObjId] },
      deletedAt: null,
      deletedFor: { $nin: [userObjId] },
    };
    const removedAtDate = getRemovedAt(conv.removedAt, userId);
    if (conv.type === 'group' && removedAtDate) deliveredQuery.createdAt = { $lte: new Date(removedAtDate) };
    const messagesToUpdate = await Message.find(deliveredQuery).lean();
    for (const msg of messagesToUpdate) {
      await Message.findByIdAndUpdate(msg._id, { $addToSet: { deliveredBy: userObjId } });
    }
    if (messagesToUpdate.length === 0) continue;
    const updatedMessages = await Message.find({ _id: { $in: messagesToUpdate.map((m) => m._id) } })
      .populate('sender', 'name nickname avatar')
      .lean();
    const getSenderName = (m) => (m.sender ? (m.sender.nickname?.trim() || m.sender.name) : (m.senderName || 'Anónimo'));
    const getSenderAvatar = (m) => (m.sender && m.sender.avatar ? m.sender.avatar : null);
    const removedAt = conv.type === 'group' ? conv.removedAt : null;
    for (const m of updatedMessages) {
      payloads.push(messageToPayload(m, resolvedChatId, getSenderName(m), null, getSenderAvatar(m), removedAt));
    }
  }
  return payloads;
}

async function markConversationAsRead(conversationId, userId) {
  if (!conversationId || !userId) return;
  const conv = await getOrCreateConversation(conversationId);
  if (!conv) return;
  if (conv.type === 'group') {
    const removed = (conv.removedParticipantIds || []).map((id) => id.toString());
    if (removed.includes(String(userId))) return;
    const removedAtDate = getRemovedAt(conv.removedAt, userId);
    if (removedAtDate) {
      const cutOff = new Date(removedAtDate);
      await Message.updateMany(
        { conversation: conv._id, createdAt: { $lte: cutOff } },
        { $addToSet: { readBy: mongoose.Types.ObjectId.isValid(String(userId)) && String(userId).length === 24 ? new mongoose.Types.ObjectId(userId) : userId } }
      );
      return;
    }
  }
  const idStr = String(userId);
  const readByValue =
    mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24
      ? new mongoose.Types.ObjectId(idStr)
      : idStr;
  await Message.updateMany(
    { conversation: conv._id },
    { $addToSet: { readBy: readByValue } }
  );
}

async function deleteMessageForMe(messageId, userId) {
  if (!messageId || !userId) return null;
  const msg = await Message.findById(messageId);
  if (!msg) return null;
  if (msg.deletedAt) return null;
  const userObjId = new mongoose.Types.ObjectId(userId);
  if (!(msg.deletedFor || []).some((id) => id.toString() === userId)) {
    msg.deletedFor = (msg.deletedFor || []).concat(userObjId);
    await msg.save();
  }
  return { messageId: msg._id.toString(), chatId: msg.conversation.toString(), scope: 'for_me' };
}

async function deleteMessageForEveryone(messageId, userId) {
  if (!messageId || !userId) return null;
  const msg = await Message.findById(messageId);
  if (!msg) return null;
  const senderId = msg.sender ? msg.sender.toString() : (msg.senderIdFallback || null);
  if (senderId !== userId) return null;
  if (msg.deletedAt) return { messageId: msg._id.toString(), chatId: msg.conversation.toString(), scope: 'for_everyone' };
  msg.deletedAt = new Date();
  msg.deletedBy = new mongoose.Types.ObjectId(userId);
  await msg.save();
  return { messageId: msg._id.toString(), chatId: msg.conversation.toString(), scope: 'for_everyone' };
}

async function clearConversationForMe(conversationId, userId) {
  if (!conversationId || !userId) return null;
  const conv = await getOrCreateConversation(conversationId);
  if (!conv) return null;
  const userObjId = new mongoose.Types.ObjectId(userId);
  const res = await Message.updateMany(
    { conversation: conv._id, deletedAt: null, deletedFor: { $nin: [userObjId] } },
    { $addToSet: { deletedFor: userObjId } }
  );
  const resolvedChatId = (conversationId === 'chat-1' || conversationId === 'general') ? conversationId : conv._id.toString();
  return { chatId: resolvedChatId, modifiedCount: res.modifiedCount };
}

function isGroupAdmin(conv, userId) {
  if (!conv || !userId) return false;
  const uid = userId.toString();
  if (conv.adminIds && conv.adminIds.length > 0) {
    return conv.adminIds.some((id) => id.toString() === uid);
  }
  return conv.createdBy && conv.createdBy.toString() === uid;
}

async function addParticipantToGroup(conversationId, userIdToAdd, requesterId) {
  if (!conversationId || !userIdToAdd || !requesterId) return { error: 'Parámetros inválidos' };
  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return { error: 'Conversación no encontrada' };
  if (conv.type !== 'group') return { error: 'No es un grupo' };
  if (!isGroupAdmin(conv, requesterId)) return { error: 'Solo un administrador puede añadir participantes' };
  const addId = new mongoose.Types.ObjectId(userIdToAdd);
  const inParticipants = conv.participants.some((p) => p.toString() === addId.toString());
  const inRemoved = (conv.removedParticipantIds || []).some((id) => id.toString() === addId.toString());
  if (inParticipants && !inRemoved) return { error: 'El usuario ya está en el grupo' };
  const uidStr = addId.toString();
  if (inParticipants && inRemoved) {
    await Conversation.findByIdAndUpdate(conversationId, {
      $pull: { removedParticipantIds: addId },
    });
    return { ok: true, conversationId: conv._id.toString() };
  }
  await Conversation.findByIdAndUpdate(conversationId, {
    $addToSet: { participants: addId },
    $pull: { removedParticipantIds: addId },
  });
  return { ok: true, conversationId: conv._id.toString() };
}

async function removeParticipantFromGroup(conversationId, userIdToRemove, requesterId) {
  if (!conversationId || !userIdToRemove || !requesterId) return { error: 'Parámetros inválidos' };
  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return { error: 'Conversación no encontrada' };
  if (conv.type !== 'group') return { error: 'No es un grupo' };
  if (!isGroupAdmin(conv, requesterId)) return { error: 'Solo un administrador puede eliminar participantes' };
  const removeId = new mongoose.Types.ObjectId(userIdToRemove);
  if (!conv.participants.some((p) => p.toString() === removeId.toString())) {
    return { error: 'El usuario no está en el grupo' };
  }
  const uidStr = removeId.toString();
  await Conversation.findByIdAndUpdate(conversationId, {
    $addToSet: { removedParticipantIds: removeId },
    $pull: { adminIds: removeId },
    $set: { [`removedAt.${uidStr}`]: new Date() },
  });
  return { ok: true, conversationId: conv._id.toString() };
}

module.exports = {
  getOrCreateConversation,
  getOrCreateDirectConversation,
  getConversationsForUser,
  createGroupConversation,
  saveMessage,
  getMessageHistory,
  toggleReaction,
  fetchAndAttachLinkPreview,
  markConversationAsRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  clearConversationForMe,
  addParticipantToGroup,
  removeParticipantFromGroup,
  markMessageDelivered,
  markAllConversationsDeliveredForUser,
};
