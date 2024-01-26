const mongoose = require("mongoose");
const shortid = require("shortid");

const timeOffRequestSchema = new mongoose.Schema({
  
  _id: {
    type: String,
    default: shortid.generate,
  },
  employeeCode: {
    type: Number,
    required: true,
    unique: false, // set unique property to false
    length: 10,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "denied"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TimeOffRequest", timeOffRequestSchema);
