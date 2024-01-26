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


// ejs route to render the time-records page

routes.get('/time-records', async (req, res) => {
  try {
    const timeRecords = await timeRecordModel.find();
    const employees = [];
    for (const record of timeRecords) {
      const employee = await employeeModel.findOne({ employeeCode: record.employeeCode });
      if (!employee) {
        return res.status(400).json({ error: "Employee not found" });
      }
      employees.push(employee);
    }
    res.render('time-records', { timeRecords, employees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


routes.put("/employees/:employeeCode", checkAuth, async (req, res) => {
  try {
    const { employeeCode } = req.params;
    const { firstName, lastName, hourlyRate, password } = req.body;
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



routes.post("/employee", async (req, res) => {
  try {
    const { firstName, lastName, hourlyRate, employeeCode, password } = req.body;

    const existingEmployee = await employeeModel.findOne({ employeeCode });
    if (existingEmployee) {
      return res.status(400).json({ error: "Employee already exists" });
    }
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

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

routes.get("/employee-management", async (req, res) => {
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
routes.get('/employee/:id', async (req, res) => {
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

routes.get("/manager-panel", checkAuth, (req, res) => {
  res.sendFile(__dirname + "/manager-panel.html");
})
routes.get("/time-record", (req, res) => {
  res.sendFile(__dirname + "/time-records.html");
});


// Update a specific employee in time management system
routes.put("/employees/:id", checkAuth, async (req, res) => {
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

// Delete a specific employee in time management system
routes.delete("/employees/:employeeCode", checkAuth, async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;
    const deleteEmployee = await employeeModel.findOneAndDelete({ employeeCode });
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
// Sample user
// {
//     "username": "image.png",
//     "password": "password$123",
//     "email": "something@something.com"
//     }

// Sample Token Response
// {
//     "status": true,
//     "username": "2p@p.com",
//     "message": "Login successful",
// }

// Login to an existing manager account with a username and password

routes.get("/login", async (req, res) => {
  // return login.html in routes folder
  res.sendFile(__dirname + "/manager-login.html")
})



routes.post("/login", async (req, res) => {
  const manager = await managerModel.find({ username: req.body.username });
  console.log(manager);
  if (manager == null) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid username and password" });
  }
  try {
    if (await bcrypt.compare(req.body.password, manager[0].password)) {
      const accessToken = jwt.sign(
        req.body.username,
        process.env.ACCESS_TOKEN_SECRET
      );
      res.setHeader("Authorization", "Bearer " + accessToken);
      res.cookie("token", accessToken, { httpOnly: true });
      res.redirect('http://localhost:3030/api/manager/manager-panel/');
    } else {
      res.status(400).json({
        status: false,
        message: "Invalid username and password",
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

});
routes.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('http://localhost:3030/api/manager/login');
})

// GET all time off requests
routes.get('/time-off-requests', async (req, res) => {
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

    res.render('manager-timeoff-requests', { requests, employees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a time off request status
// Update a time off request
routes.post('/time-off-requests/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const update = req.body;
    const options = { new: true };

    const updatedRequest = await TimeRequestModel.findByIdAndUpdate(requestId, update, options);

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Time off request not found' });
    }

    res.redirect('http://localhost:3030/api/manager/time-off-requests');
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

routes.post('/time-off-request/:id', async (req, res) => {
  try {
    const request = await TimeRequestModel.findByIdAndDelete(req.params.id);
    console.log("HEEEEEEEEEE")
    if (!request) {
      return res.status(404).json({ message: 'Time off request not found' });
    }
    res.redirect('http://localhost:3030/api/manager/time-off-requests');
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})
routes.get('/schedule-upload/', (req, res) => {
  res.render('schedule-upload');
})

routes.post('/schedule-upload', upload.single('file'), (req, res) => {
  // Read the file data and create a buffer
  const fileData = fs.readFileSync(req.file.path);
  const buffer = Buffer.from(fileData);

  // Create a new Schedule object and save it to the database
  const schedule = new ScheduleModel({
    name: req.body.name,
    data: buffer,
    mimeType: req.file.mimetype,
  });
  schedule.save()
    .then(() => {
      res.redirect('/schedule');
    })
    .catch((err) => {
      res.status(500).json({ message: err.message });
    });
})


module.exports = routes;
