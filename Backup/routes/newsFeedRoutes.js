const NewsFeed = require('../models/newsFeedModel');
const express = require('express');
const app = express.Router();
const routes = express.Router();

// Create a new announcement
app.post("/api/news", async (req, res) => {
    try {
        const { title, description } = req.body;
        const news = new NewsFeed({ title, description });
        news.save();
        return res.status(201).json({ message: 'News created successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all announcements
app.get("/api/news", async (req, res) => {
    try {
      const data = await NewsFeed.find({}, {title: 1, description: 1, _id: 0}).sort({date: -1});
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
});

// Get a specific announcement

module.exports = app;