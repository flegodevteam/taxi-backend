const express = require('express');
const router = express.Router();
const { createUser,registerUser,getUserByEmail,loginUser,getAllUsers,deleteUser,loginByPhoneNumber,loginUserByEmail } = require('../controllers/userController');
const {authenticateToken} = require("../Middleware/Auth")

router.post('/create', createUser);

//reg
router.post('/register', registerUser);

router.get('/get-user-by-email/:email', authenticateToken,getUserByEmail);

// Login route
router.post('/login', loginUser);

//get all users
router.get('/get-all-users',getAllUsers);

// Route to delete a user by email
router.delete('/delete-user/:email', authenticateToken,deleteUser);

router.post('/user-Login-by-phoneNumber', loginByPhoneNumber);


router.post('/user-Login-by-email', loginUserByEmail);


module.exports = router;
