const express = require('express');
const router = express.Router();
const {updateDriver,getAllBannedDrivers,getActiveDriversWithLocation,getAllDrivers,getDriverByEmail,deleteDriver,updatePaymentStatus,loginByPhoneNumber ,registerDriver, updateDriverLocation,driverLogin,updateIsAdminApprove,updateIsActive,driverLoginByEmail} = require('../controllers/driverController');
const {authenticateToken} = require("../Middleware/Auth")


//get all drivers
router.get('/get-all-drivers', authenticateToken,getAllDrivers);

// Route to get a driver by email
router.get('/get-driver-by-driverId/:driverId', authenticateToken,getDriverByEmail);

//delete a driver
router.delete('/delete-driver/:driverId', authenticateToken,deleteDriver );

// Route to update payment status for a driver by email
router.put('/update-payment-status/:driverId', authenticateToken,updatePaymentStatus);

router.post('/login-by-phone', loginByPhoneNumber);

//register drivers
router.post('/register-drivers', registerDriver);

//update driver location
router.put('/update-location', authenticateToken,updateDriverLocation);

//driver login
router.post('/driver-Login', driverLogin);

// Update admin approval status
router.put('/update-admin-approve/:driverId', authenticateToken,updateIsAdminApprove);

// Update active status
router.put('/update-active-status/:driverId',authenticateToken, updateIsActive);

//driver login by email and pw
router.post('/driver-Login-by-email', driverLoginByEmail);


router.get('/get-all-active-drivers',authenticateToken,getActiveDriversWithLocation);

router.get('/get-all-banned-drivers',getAllBannedDrivers);

router.put('/update-driver-details/:driverId',authenticateToken,updateDriver);


module.exports = router;
