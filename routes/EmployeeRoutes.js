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
routes.post("/create", checkAuth, async (req, res) => {
  const salt = await bcrypt.genSalt(10);
  // const employeeCode = Math.floor(Math.random() * 10000);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);
    // Check for negative or too high hourly rate
    // if (req.body.hourlyRate < 0 || req.body.hourlyRate > 350) {
    //   return res.status(400).json({ message: "Hourly rate must be between 0 and 350" });
    // }
  const employee = new employeeModel({
    employeeCode: employeeCode,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    password: hashedPassword,
    hourlyRate: req.body.hourlyRate,
  }
  );
  try {
    const newEmployee = await employee.save();
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


//employee login route 
routes.post("/login", async (req, res) => {
  const employeeCode = parseInt(req.body.employeeCode);

  if (isNaN(employeeCode)) {
    req.flash('error', 'Invalid employee code. Please enter a number.');
    return res.redirect('/api/emp/login');
  }
  const employee = await employeeModel.findOne({ employeeCode: req.body.employeeCode });
  console.log(employee);
  console.log(req.body.employeeCode, req.body.password)
  if (!employee) {
    req.flash('error', 'Invalid employee code or password'); // Set the flash message
    return res.redirect('/api/emp/login');
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
      res.redirect('/api/emp/employee-panel'); // Redirect to the profile page
    } else {
      req.flash('error', 'Invalid employee code or password'); // Set the flash message
      res.redirect('/api/emp/login');
    }
  } catch (error) {
    req.flash('error', error.message); // Set the flash message
    res.redirect('/api/emp/login');
  }
});

// employee logout route
routes.get("/logout", (req, res) => {
  // Destroy the session and redirect to the login page
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.clearCookie("token");
      res.redirect("https://time-master.herokuapp.com/api/emp/login") // Redirect to the login page
    }
  });
})

routes.get('/hours-worked', async (req, res) => {


  // Retrieve the employee data from the session
  const employee = req.session.employee;
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login'); // Redirect to login page with flash message
  }

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
  console.log(totalHoursWorked, employee.hourlyRate)
  //round to 2 decimal places
  totalHoursWorked = Math.round(totalHoursWorked * 100) / 100;
  const totalPay = totalHoursWorked * employee.hourlyRate;

  // Render the hours-worked.ejs template, passing in the daily hours data
  res.render('hours-worked', { dailyHours, totalHoursWorked, employee, totalPay, today, startOfWeek, endOfWeek });
});





routes.get("/login", (req, res) => {
  const messages = req.flash(); // Get the flash messages
  res.render("employee-login", { messages }); // Pass the messages variable to the view
});
routes.get('/profile', (req, res) => {
  const employee = req.session.employee;
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login'); // Redirect to login page with flash message
  }
  res.render('profile', { employee: employee });
});
// Route for employees to request time off
routes.post('/time-off-requests', checkAuth, async (req, res) => {
  try {
    const { employeeCode, startDate, endDate, reason } = req.body;
    const employee = req.session.employee;
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found' });
    }
    // Check if the start date is in the past
    const currentDate = new Date();
    if (new Date(startDate) < currentDate) {
      req.flash('error', 'Start date cannot be in the past');
      return res.redirect('/api/emp/time-off-requests')
    }

    // Check if the end date is before the start date
    if (new Date(endDate) < new Date(startDate)) {
      req.flash('error', 'End date cannot be before start date');
      return res.redirect('/api/emp/time-off-requests')
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
    req.flash('success', 'Time off request submitted successfully');
    return res.redirect('/api/emp/time-off-requests')
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/api/emp/time-off-requests')
  }
});

// delete time off request
routes.post('/time-off-requests/:id', checkAuth, async (req, res) => {
  try {
    const request = await timeRequestModel.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Time off request not found' });
    }
    res.redirect('https://time-master.herokuapp.com/api/emp/time-off-requests');
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})



routes.get("/clock", (req, res) => {
  const employee = req.session.employee;
  const messages = req.flash(); 
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login', { messages }); // Redirect to login page with flash message
  }
  res.render("clock-in-out",{messages, employee});
})

routes.get("/employee-panel", (req, res) => {

  const employee = req.session.employee;
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login'); // Redirect to login page with flash message
  }
  res.sendFile(__dirname + "/employee-panel.html");
});

routes.get("/time-off-requests", async (req, res) => {
  const messages = req.flash();
  const employee = req.session.employee;
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login'); // Redirect to login page with flash message
  }
  try {
    // Retrieve the employee data from the session
    const employee = req.session.employee;
    const employeeCode = employee.employeeCode;

    // Find the time-off requests for the employee
    const requests = await timeRequestModel.find({ employeeCode });

    // Render the timeoff-requests.ejs template, passing in the requests data
    res.render("time-off-requests", { requests, employee , messages});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

routes.post("/clock-in", checkAuth, async (req, res) => {
  try {
    const { employeeCode } = req.body;

    const employee = await employeeModel.findOne({ employeeCode });
    if (!employee) {
      return res.status(400).json({ error: "Employee not found" });
    }

    const timeClock = await timeRecordModel.findOne({
      employeeCode,
      type: "clock-in",
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    if (timeClock) {
      return res.status(400).json({
        error: "You are clocked in already for today. Please clock-out first.",
      });
    }

    const timeClockOut = await timeRecordModel.findOne({
      employeeCode,
      type: "clock-out",
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });

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



// routes.post("/clock-in", checkAuth, async (req, res) => {
//   try {
//     const { employeeCode } = req.body;

//     const employee = await employeeModel.findOne({ employeeCode });
//     if (!employee) {
//       req.flash('error', 'Employee not found');
//       return res.redirect('/api/emp/clock');
//     }

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const timeClock = await timeRecordModel.findOne({
//       employeeCode,
//       type: "clock-in",
//       date: new Date(),
//     });
//     if (timeClock) {
//       req.flash('error', 'You are clocked in already for today. Please clock-out first.');
//       return res.redirect('/api/emp/clock');
//     }

//     const clockInRecord = new timeRecordModel({
//       employeeCode,
//       type: "clock-in",
//       date: new Date(),
//     });
//     await clockInRecord.save();

//     req.flash('success', 'Clock-in recorded successfully');
//     return res.redirect('/api/emp/clock');
//   } catch (error) {
//     req.flash('error', error.message);
//     res.redirect('/api/emp/clock');
//   }
// });


routes.post("/clock-out", checkAuth, async (req, res) => {
  try {
    const { employeeCode } = req.body;

    const employee = await employeeModel.findOne({ employeeCode });
    if (!employee) {
      return res.status(400).json({ error: "Employee not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const timeClockOut = await timeRecordModel.findOne({
      employeeCode,
      type: "clock-out",
      date: new Date(),
    });
    if (timeClockOut) {
      return res.status(400).json({
        error: "You have already clocked out for today. Please check your clock-in and clock-out records.",
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

// routes.post("/clock-out", checkAuth, async (req, res) => {
//   try {
//     const { employeeCode } = req.body;

//     const employee = await employeeModel.findOne({ employeeCode });
//     if (!employee) {
//       req.flash('error', 'Employee not found');
//       return res.redirect('/api/emp/clock');
//     }

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const timeClock = await timeRecordModel.findOne({
//       employeeCode,
//       type: "clock-out",
//       date: new Date(),
//     });
//     if (timeClock) {
//       req.flash('error', 'You are clocked out already for today. Please clock-in first.');
//       return res.redirect('/api/emp/clock');
//     }

//     const clockOutRecord = new timeRecordModel({
//       employeeCode,
//       type: "clock-out",
//       date: new Date(),
//     });
//     await clockOutRecord.save();

//     req.flash('success', 'Clock-out recorded successfully');
//     return res.redirect('back');
//   } catch (error) {
//     req.flash('error', error.message);
//     res.redirect('/api/emp/clock');
//   }
// });


routes.get('/view-schedules/', (req, res) => {
  const employee = req.session.employee;
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login'); // Redirect to login page with flash message
  }
  ScheduleModel.find({}, (err, schedules) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }

    res.render('view-schedules', { schedules });
  });
})

// Download Schedule 
routes.get('/schedule/:id', checkAuth, (req, res) => {
  ScheduleModel.findById(req.params.id, (err, schedule) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }

    res.set('Content-Type', 'text/csv');
    res.attachment(`${schedule.name}.csv`);
    res.send(schedule.data);
  });
});
// Update employee password
routes.post("/employee/password", checkAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const employee = req.session.employee;
    const employeeCode = employee.employeeCode;
    const existingEmployee = await employeeModel.findOne({ employeeCode });
    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const passwordMatch = await bcrypt.compare(oldPassword, existingEmployee.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    existingEmployee.password = hashedPassword;
    await existingEmployee.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Render password update form
routes.get("/employee/password", async (req, res) => {
  const employee = req.session.employee;
  if (!employee) {
    req.flash('error', 'Please log in to access your profile.'); // Set flash message
    return res.redirect('/api/emp/login'); // Redirect to login page with flash message
  }
  try {
    const employee = req.session.employee;
    const employeeCode = employee.employeeCode;
    const existingEmployee = await employeeModel.findOne({ employeeCode });

    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.render("updatePassword", { employee: existingEmployee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = routes;
