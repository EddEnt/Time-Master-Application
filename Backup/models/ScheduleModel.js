const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  data: {
    type: Buffer,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const ScheduleModel = mongoose.model('Schedule', ScheduleSchema);

module.exports = ScheduleModel;
