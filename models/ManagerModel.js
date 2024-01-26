const mongoose = require('mongoose')



//Josiah Galloway 101296257

const ManagerSchema = mongoose.Schema({
    username: 
    { 
        type: String, 
        required: true, 
        unique: true,
        maxLength: 50 }
    ,
    // Upped the password length to 100 characters as I save them in a secure encrypted format and it requires more space
    password: {
        type: String,
        required: true,
        maxLength: 100

    }
})


module.exports = mongoose.model('Manager', ManagerSchema);