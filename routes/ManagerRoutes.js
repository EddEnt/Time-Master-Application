const timeOff = require("../models/TimeRequestModel");
const employeeModel = require("../models/EmployeesModel");
const managerModel = require("../models/ManagerModel");
const timeRecordModel = require("../models/TimeRecordModel");
const ScheduleModel = require("../models/ScheduleModel");
const express = require("express");
const routes = express.Router();
const bcrypt = require("bcrypt");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const checkAuth = require("../middleware/check-auth");
const TimeRequestModel = require("../models/TimeRequestModel");
const multer = require('multer');
const flash = require('connect-flash');
const TimeRecordModel = require("../models/TimeRecordModel");
const NewsFeed = require("../models/newsFeedModel");
const newsFeedModel = require("../models/newsFeedModel");



// function to check if user is authenticated and redirect to login page if not

function authenticate(req, res, next) {
  const accessToken = req.cookies.token;
  if (!accessToken) {
    req.flash('error', 'Please log in to access the manager panel');
    return res.redirect('/api/manager/login');
  }
  try {
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    req.flash('error', 'Please log in to access the manager panel');
    return res.redirect('/api/manager/login');
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
});

const upload = multer({ storage: storage });

require("dotenv").config();

routes.get('/time-records', authenticate, async (req, res) => {
  try {
    const timeRecords = await timeRecordModel.find();
    const employees = [];
    for (const record of timeRecords) {
      const employee = await employeeModel.findOne({ employeeCode: record.employeeCode });
      console.log(employee);
      if (!employee) {
        return res.status(400).json({ error: "Employee not found" });
      }
      employees.push(employee);
    }
    res.render('time-records', { timeRecords, employees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})



routes.put("/employees/:employeeCode", authenticate, async (req, res) => {
  try {
    const { employeeCode } = req.params;
    const { firstName, lastName, hourlyRate, password } = req.body;
    if (req.body.hourlyRate < 0 || req.body.hourlyRate > 350) {
      throw new Error("Hourly rate must be between 0 and 350");
    }
    const updatedEmployee = await employeeModel.findOneAndUpdate(
      { employeeCode },
      { firstName, lastName, hourlyRate, password },
      { new: true }
    );
    res.json(updatedEmployee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



routes.post("/employee", authenticate, async (req, res) => {
  try {
    const { firstName, lastName, hourlyRate, employeeCode, password } = req.body;

    const existingEmployee = await employeeModel.findOne({ employeeCode });
    if (existingEmployee) {
      throw new Error("Employee already exists");
    }
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    if (req.body.hourlyRate < 0 || req.body.hourlyRate > 350) {
      throw new Error("Hourly rate must be between 0 and 350");
    }
    const employee = new employeeModel({
      firstName,
      lastName,
      hourlyRate,
      employeeCode,
      password: hashedPassword
    });
    await employee.save();

    return res.status(201).json({ message: "Employee created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee-management page where manager can create , edit and delete employees
routes.get("/employee-management", authenticate, async (req, res) => {
  res.sendFile(__dirname + "/employee-creation.html");
})

routes.get("/employees", checkAuth, async (req, res) => {
  try {
    const employees = await employeeModel.find();
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})

// Get a specific employee in time management system
routes.get('/employee/:id', authenticate, async (req, res) => {
  try {
    const getEmployee = await employeeModel.findById(req.params.id, req.body)
    res.send(getEmployee)
  }
  catch (error) {
    res.status(500).json({ message: error.message })
  }
}
)
// Get manager-panel page

routes.get("/manager-panel", authenticate, (req, res) => {
  res.sendFile(__dirname + "/manager-panel.html");
})

// Update a specific employee in time management system
routes.put("/employees/:id", authenticate, async (req, res) => {
  try {
    const updateEmployee = await employeeModel.findByIdAndUpdate(
      req.params.id,
      req.body
    );
    res.send(updateEmployee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a specific employee in time management system and all of their time records and time off requests
routes.delete("/employees/:employeeCode", authenticate, async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;
    const deleteEmployee = await employeeModel.findOneAndDelete({ employeeCode });
    const deleteTimeRecords = await TimeRecordModel.deleteMany({ employeeCode: employeeCode });
    const deleteTimeOffRequests = await TimeRequestModel.deleteMany({ employeeCode: employeeCode });

    res.status(204).json({ message: "Employee deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Create a new manager account with a username, password, and email
routes.post("/signup", async (req, res) => {
  try {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const newManager = new managerModel({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
    });
    await newManager.save();
    res.status(201).send(newManager);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Login to an existing manager account with a username and password

routes.get("/login", async (req, res) => {
  const messages = req.flash(); // Get the flash messages
  res.render("manager-login", { messages });
})

routes.post("/login", async (req, res) => {
  const manager = await managerModel.find({ username: req.body.username });
  if (manager == null) {
    req.flash('error', 'Invalid username or password');
    return res.redirect('/api/manager/login');
  }
  try {
    if (await bcrypt.compare(req.body.password, manager[0].password)) {
      const accessToken = jwt.sign(
        req.body.username,
        process.env.ACCESS_TOKEN_SECRET
      );
      res.setHeader("Authorization", "Bearer " + accessToken);
      res.cookie("token", accessToken, { httpOnly: true });
      res.redirect('https://time-master.herokuapp.com/api/manager/manager-panel/');
    } else {
      req.flash('error', 'Invalid username or password');
      res.redirect('/api/manager/login');
    }
  } catch (error) {
    req.flash('error', error.message);
    res.redirect('/api/manager/login');
  }
});
routes.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('https://time-master.herokuapp.com/api/manager/login');
})

// GET all time off requests
routes.get('/time-off-requests', authenticate, async (req, res) => {
  const messages = req.flash()  // Get the flash messages
  try {
    const requests = await TimeRequestModel.find();
    const employees = [];

    for (const request of requests) {
      const employee = await employeeModel.findOne({ employeeCode: request.employeeCode });

      if (!employee) {
        return res.status(400).json({ error: "Employee not found" });
      }

      employees.push(employee);
    }

    res.render('manager-timeoff-requests', { requests, employees, messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a time off request status
// Update a time off request
routes.post('/time-off-requests/:id', authenticate, async (req, res) => {
  try {
    const requestId = req.params.id;
    const update = req.body;
    const options = { new: true };

    const updatedRequest = await TimeRequestModel.findByIdAndUpdate(requestId, update, options);

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Time off request not found' });
    }
    req.flash('success', 'Time off request updated successfully')
    res.redirect('/api/manager/time-off-requests');
  } catch (error) {
    res.status(500).json({ message: error.message });
    req.flash('error', error.message)
  }
});

routes.post('/time-off-request/:id', authenticate, async (req, res) => {
  try {
    const request = await TimeRequestModel.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Time off request not found' });
    }
    req.flash('success', 'Time off request deleted successfully')
    res.redirect('/api/manager/time-off-requests');
  } catch (error) {
    res.status(500).json({ message: error.message });
    req.flash('error', error.message)
  }
})
routes.get('/schedule-upload/', authenticate, (req, res) => {
  ScheduleModel.find({}, (err, schedules) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.render('schedule-upload', {
      schedules: schedules,
      messages: req.flash()
    })
  });
});

const { createReadStream } = require('fs');

function readStreamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
routes.post('/schedule-upload', authenticate, upload.single('file'), async (req, res) => {
  // Check if file is present in request
  if (!req.file) {
    req.flash('msg-error', 'Error uploading schedule: No file was uploaded');
    req.session.save(() => {
      res.redirect('/api/manager/schedule-upload/');
    });
    return; // Return to stop further execution of the function
  }

  const { name, mimetype } = req.file;

  if (mimetype !== 'text/csv') {
    req.flash('msg-error', 'Error uploading schedule: Only CSV files are allowed');
    req.session.save(() => {
      res.redirect('/api/manager/schedule-upload/');
    });
    return; // Return to stop further execution of the function
  }

  const buffer = await readStreamToBuffer(createReadStream(req.file.path)); // create a buffer from the stream

  const uploadStream = await ScheduleModel.create({
    name: req.body.name,
    mimeType: mimetype,
    data: buffer, // use the buffer as the value of the data field
  });

  try {
    req.flash('msg-success', 'Schedule uploaded successfully');
    req.session.save(() => {
      res.redirect('/api/manager/schedule-upload/');
    });
  } catch (err) {
    req.flash('msg-error', 'Error uploading schedule: ' + err.message);
    req.session.save(() => {
      res.redirect('/api/manager/schedule-upload/');
    });
  }
});



// Delete schedule
routes.post('/delete-schedule/:id', authenticate, async (req, res) => {
  const scheduleId = req.params.id;

  try {
    // Find schedule by id and check if it exists
    const schedule = await ScheduleModel.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    // Delete schedule from database
    await ScheduleModel.findByIdAndDelete(scheduleId);

    req.flash('msg-success', 'Schedule deleted successfully');
    res.redirect('/api/manager/schedule-upload');
  } catch (error) {
    req.flash('msg-error', error.message);
    console.log(error.message)
    res.redirect('/api/manager/schedule-upload');
  }
});
// News Feed Routes below 

routes.get("/announcement", async (req, res) => {
  let newsFeed = []; // Define the variable and assign a default value
  try {
    newsFeed = await NewsFeed.find(); // Update the variable with the result of the find() method
  } catch (err) {
    req.flash("error", err.message)
  }

  res.render("announcements", { newsFeed, messages: req.flash() }); // Pass the news variable to the view
});


// Delete an announcement
routes.post("/newsfeed/delete/:id", checkAuth, async (req, res) => {
  const itemId = req.params.id;

  try {
    await NewsFeed.findByIdAndRemove(itemId);
    req.flash("success", "News feed item deleted successfully.");
  } catch (err) {
    req.flash("error", "Failed to delete news feed item. " + err.message);
  }

  res.redirect("/api/manager/announcement");
});

// POST route for editing a news feed item
routes.post("/newsfeed/edit/:id", checkAuth, async (req, res) => {
  const itemId = req.params.id;
  const { title, description , issuedBy } = req.body;

  try {
    await NewsFeed.findByIdAndUpdate(itemId, { title, description , issuedBy });
    req.flash("success", "News feed item updated successfully.");
  } catch (err) {
    req.flash("error", "Failed to update news feed item. " + err.message);
  }

  res.redirect("/api/manager/announcement");
});


routes.post("/newsfeed/create", checkAuth, async (req, res) => {
  const { title, description , issuedBy } = req.body;

  try {
    const newNewsFeedItem = new NewsFeed({
      title,
      description,
      issuedBy
    });

    await newNewsFeedItem.save();
    req.flash("success", "News feed item created successfully.");
  } catch (err) {
    req.flash("error", "Failed to create news feed item. " + err.message);
  }

  res.redirect("/api/manager/announcement");
});


// Get all announcements
routes.get("/news", async (req, res) => {
  try {
    // const data = await NewsFeed.find({}, {title: 1, description: 1, _id: 0}).sort({date: -1});
    const data = await NewsFeed.find().sort({ date: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = routes;
