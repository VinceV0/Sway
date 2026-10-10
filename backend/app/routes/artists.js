// routes/artists.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Artist = require('../models/Artist');

// Get all artists
router.get('/', async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get posts for a specific artist
router.get('/:id/posts', async (req, res) => {
  try {
    const identifier = req.params.id;
    let artist;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      artist = await Artist.findById(identifier);
    } else {
      artist = await Artist.findOne({ name: new RegExp(`^${decodeURIComponent(identifier)}$`, 'i') });
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json(artist.posts || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new post for an artist
router.post('/:id/posts', async (req, res) => {
  try {
    const identifier = req.params.id;
    let artist;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      artist = await Artist.findById(identifier);
    } else {
      artist = await Artist.findOne({ name: new RegExp(`^${decodeURIComponent(identifier)}$`, 'i') });
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const newPost = {
      id: req.body.id || Date.now().toString(),
      text: req.body.text,
      tag: req.body.tag || 'Studio Update',
      category: req.body.category || 'Studio Update',
      tagColor: req.body.tagColor,
      time: req.body.time || 'Just now',
      tags: req.body.tags,
      author: req.body.author,
      createdAt: new Date()
    };

    artist.posts.unshift(newPost);
    await artist.save();

    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an artist post
router.delete('/:id/posts/:postId', async (req, res) => {
  try {
    const { id, postId } = req.params;
    let artist;

    if (mongoose.Types.ObjectId.isValid(id)) {
      artist = await Artist.findById(id);
    } else {
      artist = await Artist.findOne({ name: new RegExp(`^${decodeURIComponent(id)}$`, 'i') });
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    artist.posts = artist.posts.filter(p => p.id !== postId && p._id?.toString() !== postId);
    await artist.save();

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get chat messages for a specific artist
router.get('/:id/messages', async (req, res) => {
  try {
    const identifier = req.params.id;
    const userEmail = req.query.user_email;
    let artist;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      artist = await Artist.findById(identifier);
    } else {
      artist = await Artist.findOne({ name: new RegExp(`^${decodeURIComponent(identifier)}$`, 'i') });
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const db = mongoose.connection.db;
    const query = { 
      artist_name: new RegExp(`^${artist.name}$`, 'i')
    };
    if (userEmail) {
      query.user_email = userEmail.toLowerCase();
    }

    const messages = await db.collection('messages').find(query).sort({ created_at: 1, _id: 1 }).toArray();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post a chat message for a specific artist
router.post('/:id/messages', async (req, res) => {
  try {
    const identifier = req.params.id;
    let artist;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      artist = await Artist.findById(identifier);
    } else {
      artist = await Artist.findOne({ name: new RegExp(`^${decodeURIComponent(identifier)}$`, 'i') });
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const { sender, sender_name, text, user_email, time } = req.body;
    const db = mongoose.connection.db;

    const newMessage = {
      sender,
      sender_name: sender_name || (sender === 'artist' ? artist.name : 'Listener'),
      text,
      user_email: user_email ? user_email.toLowerCase() : '',
      artist_name: artist.name,
      time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: new Date()
    };

    const savedMessage = await db.collection('messages').insertOne(newMessage);
    res.status(201).json({ ...newMessage, _id: savedMessage.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;