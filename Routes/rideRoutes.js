const express = require('express');
const router = express.Router();
const {requestRide,getRideRequestsForDriver,handleRideRequest,updateWaitingTime,getRideDetails,updateRideStatus} = require("../controllers/RideController")
const {authenticateToken} = require("../Middleware/Auth")

router.post('/request-ride', authenticateToken,requestRide);

router.get('/ride-requests/:driverEmail',authenticateToken, getRideRequestsForDriver);

router.post('/handle-ride-request/:driverEmail', authenticateToken,handleRideRequest);

router.put("/update-Waiting-Time/:confirmedRideId", updateWaitingTime);

router.get('/get-ride-by-rideId/:rideId', getRideDetails);

router.put("/update-ride/:rideId", updateRideStatus);

module.exports = router;
