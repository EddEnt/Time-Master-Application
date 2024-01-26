const mongoose = require('mongoose');

//Josiah Galloway 101296257


const EmployeeSchema = mongoose.Schema({
    firstName: {
        type: String,
        length: 100,
        required: true
    },
    lastName: {
        type: String,
        length: 50,
        required: true
    },
    hourlyRate:{
        type: Number,
        required: true
    },
    employeeCode: {
        type: Number,
        required: true,
        length: 10,
        unique: true
    },
    // Upped the password length to 100 characters as I save them in a secure encrypted format and it requires more space
    password: {
        type: String,
        required: true,
        maxLength: 100
    }


})
//Josiah Galloway 101296257
module.exports = mongoose.model('Employee', EmployeeSchema);