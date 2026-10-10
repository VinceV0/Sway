// models/Track.js
const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // e.g., "track_5sos_easier"
    title: { type: String, required: true, trim: true },
    artist_name: { type: String, required: true, trim: true },
    album_name: { type: String, trim: true },
    duration_seconds: { type: Number, required: true },
    audio_url: { type: String, required: true },
    cover_art_url: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
}, { _id: false }); // Prevents mongoose from generating a default ObjectId since you use custom string IDs

module.exports = mongoose.model('Track', trackSchema);