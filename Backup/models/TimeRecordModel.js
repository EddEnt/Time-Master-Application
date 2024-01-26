const mongoose = require('mongoose')
const Schema = mongoose.Schema;
const Employee = require('./EmployeesModel')

const moment = require('moment-timezone');
const easternTimezone = 'America/New_York'; // set timezone to Eastern Standard Time

const TimeRecordSchema = new mongoose.Schema({
  employeeCode: {
    type: Number,
    ref: 'Employee',
    required: true
  },
  type: {
    type: String,
    enum: ['clock-in', 'clock-out'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: () => moment.tz(easternTimezone).toDate()  // set default to current Eastern Standard Time
  }
});


module.exports = mongoose.model('TimeRecord', TimeRecordSchema)