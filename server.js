const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const app = express();
const jwt = require("jsonwebtoken");
const flash = require("connect-flash");

// Serve static files from the "public" directory
app.use(express.static(__dirname + "/public"));

app.use(bodyParser.json());

// set route variables
const employeeRoutes = require("./routes/EmployeeRoutes");
const managerRoutes = require("./routes/ManagerRoutes");

//mongodb connection string
const Server_PORT = 3030;
//DB URL 2 =
const DB_URL =
  "mongodb+srv://admin:projectsql123@cluster0.b16uair.mongodb.net/gbc_fullstack?retryWrites=true&w=majority";

app.set("view engine", "ejs", "html");
//app.set('views', __dirname + '/routes');
app.set("views", __dirname + "/routes");

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(flash());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded());

mongoose
  .connect(DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Successfully connected to the database mongoDB Atlas Server");
  })
  .catch((err) => {
    console.log("Could not connect to the database. Exiting now...", err);
    process.exit();
  });

//configure routes
app.use("/api/emp/", employeeRoutes);
app.use("/api/manager/", managerRoutes);
//route for news feed
// app.use("/api/manager/announcement-management", newsFeedRoutes)

app.route("/").get((req, res) => {
  res.sendFile(__dirname + "/routes/index.html");
});

app.listen(process.env.PORT || Server_PORT, () =>
  console.log(`App listening at http://localhost:${Server_PORT}`)
);
