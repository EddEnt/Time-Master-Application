const employeeModel = require("../models/EmployeesModel");
const timeRecordModel = require("../models/TimeRecordModel");
const express = require("express");
const routes = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const checkAuth = require("../middleware/check-auth");
const timeRequestModel = require("../models/TimeRequestModel");
const session = require("express-session")
const fs = require('fs');
const ScheduleModel = require("../models/ScheduleModel");
const moment = require('moment-timezone');
const easternTimezone = 'America/New_York';



require("dotenv").config()

//Josiah Galloway 101296257

// create a mew employee with a hashed password and a random id generator 
routes.post("/create", async (req, res) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);
  const employeeCode = Math.floor(Math.random() * 1000000000);
  const employee = new employeeModel({
    employeeCode: employeeCode,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    hourlyRate: req.body.hourlyRate,
    password: hashedPassword,
  });
  try {
    const newEmployee = await employee.save();
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


//employee login route 
routes.post("/login", async (req, res) => {
  const employee = await employeeModel.findOne({ employeeCode: req.body.employeeCode });
  console.log(employee);
  console.log(req.body.employeeCode, req.body.password)
  if (!employee) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid username and password" });
  }
  try {
    if (await bcrypt.compare(req.body.password, employee.password)) {
      const accessToken = jwt.sign(
        req.body.employeeCode,
        process.env.ACCESS_TOKEN_SECRET
      )
      req.session.employee = employee; // Set the employee object in the session
      console.log(req.session.employee)
      res.setHeader("Authorization", "Bearer " + accessToken);
      res.cookie("token", accessToken, { httpOnly: true });
      res.redirect('http://localhost:3030/api/emp/employee-panel'); // Redirect to the profile page
    } else {
      res.status(400).json({
        status: false,
        message: "Invalid username and password",
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})

// employee logout route
routes.get("/logout", (req, res) => {
  // Destroy the session and redirect to the login page
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.clearCookie("token");
      res.redirect("http://localhost:3030/api/emp/login") // Redirect to the login page
    }
  });
})

routes.get('/hours-worked', async (req, res) => {
  // Retrieve the employee data from the session
  const employee = req.session.employee;
  const employeeCode = employee.employeeCode;

  // Calculate the start and end dates for the current week
  const today = moment.tz(easternTimezone);
  const startOfWeek = today.clone().startOf('week');
  const endOfWeek = today.clone().endOf('week');

  // Find the time records for the employee for the current week, sorted by date
  const timeRecords = await timeRecordModel
    .find({
      employeeCode: employeeCode,
      date: {
        $gte: moment(startOfWeek, 'YYYY-MM-DD').toDate(),
        $lte: moment(endOfWeek, 'YYYY-MM-DD').toDate(),
      },
    })
    .sort({ date: 1 });

  // Calculate the hours worked for each day and the total hours worked for the week
  let totalHoursWorked = 0;
  const dailyHours = {};
  timeRecords.forEach((timeRecord) => {
    const date = moment(timeRecord.date).tz(easternTimezone).format('YYYY-MM-DD');
    const time = moment(timeRecord.date).tz(easternTimezone).format('h:mmA');
  
    if (timeRecord.type === 'clock-in') {
      if (!dailyHours[date]) {
        dailyHours[date] = { clockIn: time };
      } else {
        dailyHours[date].clockIn = time;
      }
    } else {
      if (!dailyHours[date]) {
        dailyHours[date] = { clockOut: time };
      } else {
        dailyHours[date].clockOut = time;
      }
  
      // Use moment.js to calculate the time difference
      const clockInTime = moment(dailyHours[date].clockIn, 'h:mmA');
      const clockOutTime = moment(dailyHours[date].clockOut, 'h:mmA');
      const hoursWorked = moment.duration(clockOutTime.diff(clockInTime)).asHours();
  
      totalHoursWorked += hoursWorked;
      dailyHours[date].hoursWorked = hoursWorked;
    }})

  // Calculate the total pay for the week
  const totalPay = totalHoursWorked * employee.hourlyRate / 40;

  // Render the hours-worked.ejs template, passing in the daily hours data
  res.render('hours-worked', { dailyHours, totalHoursWorked, employee, totalPay });
});





routes.get("/login", async (req, res) => {
  // return employee-login.html in routes folder
    res.sendFile(__dirname + "/employee-login.html")
  })

routes.get('/profile', (req, res) => {
    const employee = req.session.employee;
    res.render('profile', { employee: employee });
  });

// Route for employees to request time off
routes.post('/time-off-requests', async (req, res) => {
  try {
    const { employeeCode, startDate, endDate, reason } = req.body;
    const employee = req.session.employee;
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found' });
    }

    const timeOffRequest = new timeRequestModel({
      employeeCode: employee.employeeCode,
      startDate,
      endDate,
      reason,
      status: 'pending'
    });

    await timeOffRequest.save();

    const requests = await timeRequestModel.find({ employeeCode: employee.employeeCode });

    return res.render('time-off-requests', { requests, employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// delete time off request
routes.post('/time-off-requests/:id', async (req, res) => {
  try {
    const request = await timeRequestModel.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Time off request not found' });
    }
    res.redirect('http://localhost:3030/api/emp/time-off-requests');
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})



routes.get("/clock", (req, res) => {
  res.sendFile(__dirname + "/clock-in-out.html");
})

routes.get("/employee-panel", checkAuth , (req, res) => {
  res.sendFile(__dirname + "/employee-panel.html");
});

routes.get("/time-off-requests", async (req, res) => {
  try {
    // Retrieve the employee data from the session
    const employee = req.session.employee;
    const employeeCode = employee.employeeCode;

    // Find the time-off requests for the employee
    const requests = await timeRequestModel.find({ employeeCode });

    // Render the timeoff-requests.ejs template, passing in the requests data
    res.render("time-off-requests", { requests, employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


routes.post("/clock-in", async (req, res) => {
  try {
    const { employeeCode } = req.body;

    const employee = await employeeModel.findOne({ employeeCode });
    if (!employee) {
      return res.status(400).json({ error: "Employee not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeClock = await timeRecordModel.findOne({
      employeeCode,
      type: "clock-in",
      date: new Date(),
    });
    if (timeClock) {
      return res.status(400).json({
        error: "You are clocked in already for today. Please clock-out first.",
      });
    }

    const clockInRecord = new timeRecordModel({
      employeeCode,
      type: "clock-in",
      date: new Date(),
    });
    await clockInRecord.save();

    return res
      .status(201)
      .json({ message: "Clock-in recorded successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


routes.post("/clock-out", async (req, res) => {
  try {
    const { employeeCode } = req.body;

    const employee = await employeeModel.findOne({ employeeCode });
    if (!employee) {
      return res.status(400).json({ error: "Employee not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeClock = await timeRecordModel.findOne({
      employeeCode,
      type: "clock-out",
      date: new Date(),
    });
    if (timeClock) {
      return res.status(400).json({
        error: "You are clocked out already for today. Please clock-in first.",
      });
    }

    const clockOutRecord = new timeRecordModel({
      employeeCode,
      type: "clock-out",
      date: new Date(),
    });
    await clockOutRecord.save();

    return res
      .status(201)
      .json({ message: "Clock-out recorded successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

routes.get('/view-schedules/', (req, res) => {
  ScheduleModel.find({}, (err, schedules) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }

    res.render('view-schedules', { schedules });
  });
})

// Download Schedule 
routes.get('/schedule/:id', (req, res) => {
  ScheduleModel.findById(req.params.id, (err, schedule) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }

    res.set('Content-Type', 'text/csv');
    res.attachment(`${schedule.name}.csv`);
    res.send(schedule.data);
  });
});



module.exports = routes;
