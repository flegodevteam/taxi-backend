const express = require('express');
const router = express.Router();
const {updateFcmToken, updateUser,getAllBannedUsers,updateUserPoints,createUser,registerUser,getUserByEmail,loginUser,getAllUsers,deleteUser,loginByPhoneNumber,loginUserByEmail } = require('../controllers/userController');
const {authenticateToken} = require("../Middleware/Auth")

router.post('/create', createUser);

//reg
router.post('/register', registerUser);

router.get('/get-user-by-userId/:userId',authenticateToken,getUserByEmail);

// Login route
router.post('/login', loginUser);

//get all users
router.get('/get-all-users',authenticateToken,getAllUsers);

// Route to delete a user by email
router.delete('/delete-user/:userId',authenticateToken,deleteUser);

router.post('/user-Login-by-phoneNumber', loginByPhoneNumber);


router.post('/user-Login-by-email', loginUserByEmail);

router.put('/update-user-points/:userId', authenticateToken,updateUserPoints );

router.get('/get-all-banned-users', authenticateToken,getAllBannedUsers );

router.put('/update-user-details/:userId',authenticateToken,updateUser );

router.put('/update-user-fcmToken/:userId',authenticateToken,updateFcmToken );



module.exports = router;
