const express = require('express');
const router = express.Router();
const {getAllDrivers,getDriverByEmail,deleteDriver,updatePaymentStatus,loginByPhoneNumber ,registerDriver, updateDriverLocation,driverLogin,updateIsAdminApprove,updateIsActive,driverLoginByEmail} = require('../controllers/driverController');
const {authenticateToken} = require("../Middleware/Auth")


//get all drivers
router.get('/get-all-drivers', authenticateToken,getAllDrivers);

// Route to get a driver by email
router.get('/get-driver-by-email/:email', authenticateToken,getDriverByEmail);

//delete a driver
router.delete('/delete-driver/:email', authenticateToken,deleteDriver );

// Route to update payment status for a driver by email
router.put('/update-payment-status/:email', authenticateToken,updatePaymentStatus);

router.post('/login-by-phone', loginByPhoneNumber);

//register drivers
router.post('/register-drivers', registerDriver);

//update driver location
router.put('/update-location', authenticateToken,updateDriverLocation);

//driver login
router.post('/driver-Login', driverLogin);

// Update admin approval status
router.put('/update-admin-approve/:email', updateIsAdminApprove);

// Update active status
router.put('/update-active-status/:email', updateIsActive);

//driver login by email and pw
router.post('/driver-Login-by-email', driverLoginByEmail);



module.exports = router;
