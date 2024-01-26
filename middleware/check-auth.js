const jwt = require("jsonwebtoken");
const express = require('express')
//Josiah Galloway 101296257
//authentication middleware to detect whether user is signed on or not and based on that allow or deny access to certain routes
module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  try {
    res.setHeader('Authorization', 'Bearer '+ req.cookies.token)
    const token = req.cookies.token;

    if (!token)
      return res.status(200).json({ message: "Authentication Failed!" });

    const decodedData = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.userData = decodedData;
    next();
  } catch (error) {
    console.log(error);
    return res.status(200).json({ message: "Authentication Failed!" });
  }
};
//Josiah Galloway 101296257