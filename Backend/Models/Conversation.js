// backend/Models/Conversation.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  fromUserID: { type: String },                 // legacy userID string (optional)
  fromRef: { type: Schema.Types.ObjectId, ref: 'User' }, // Mongo user ref (optional)
  toUserID: { type: String },
  toRef: { type: Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true },
  time: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
}, { _id: true });

const conversationSchema = new Schema({
  // participants — store both legacy userID strings and objectId references for compatibility
  participantsUserID: [{ type: String }],           // e.g. ['u123','u456']
  participantsRef: [{ type: Schema.Types.ObjectId, ref: 'User' }], // e.g. [ObjectId, ObjectId]
  // optional meta, e.g. subject, lastMessageAt
  subject: { type: String },
  lastMessageAt: { type: Date },
  messages: [messageSchema]
}, { timestamps: true });

// indexes
conversationSchema.index({ participantsUserID: 1 });
conversationSchema.index({ participantsRef: 1 });
conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
