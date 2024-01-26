const mongoose = require('mongoose');
const TimeRecord = require('./models/TimeRecord');

const getHoursWorkedPerEmployeePerWeek = async (weekStart, weekEnd) => {
  try {
    const hoursWorked = await TimeRecord.aggregate([
      {
        $match: {
          startTime: {
            $gte: weekStart,
            $lte: weekEnd
          }
        }
      },
      {
        $group: {
          _id: "$employee",
          totalHours: {
            $sum: {
              $subtract: ["$endTime", "$startTime"]
            }
          }
        }
      }
    ]);
    return hoursWorked;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
