// models/Artist.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  tag: { type: String, default: 'Studio Update' },
  category: { type: String, default: 'Studio Update' },
  tagColor: { type: String, default: 'text-blue-400 bg-blue-600/10 border-blue-600/20' },
  time: { type: String, default: 'Just now' },
  tags: { type: String },
  author: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const artistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  bio: { type: String },
  image_url: { type: String },
  posts: [postSchema]
}, { timestamps: true });

module.exports = mongoose.model('Artist', artistSchema);