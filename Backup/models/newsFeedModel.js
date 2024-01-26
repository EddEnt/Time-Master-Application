const mongoose = require('mongoose')

const newsFeedSchema = mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
});

module.exports = mongoose.model('NewsFeed', newsFeedSchema);