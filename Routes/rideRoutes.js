const express = require('express');
const router = express.Router();
const {getEndedRidesByUser,getEndedRidesByDriver,getStartedRidesByDriver,getStartedRidesByUser,updateRideCost,getLatestRideByUser,getAllRatings,getRejectedRequests,getAcceptedRequests,getAllRidesByDate,requestRide,getRideRequestsForDriver,handleRideRequest,updateWaitingTime,getRideDetails,updateRideStatus,updateRideRating,getRideRating} = require("../controllers/RideController")
const {authenticateToken} = require("../Middleware/Auth")

router.post('/request-ride', authenticateToken,requestRide);

router.get('/ride-requests/:driverId',authenticateToken, getRideRequestsForDriver);

router.post('/handle-ride-request/:driverId', authenticateToken,handleRideRequest);

router.put("/update-Waiting-Time/:confirmedRideId",authenticateToken, updateWaitingTime);

router.get('/get-ride-by-rideId/:rideId', authenticateToken,getRideDetails);

router.put("/update-ride-status/:rideId",authenticateToken, updateRideStatus);

router.get("/get-rides-count/:date",authenticateToken, getAllRidesByDate);

//fetch all accepted rides
router.get("/get-accept-ride-rqs",authenticateToken, getAcceptedRequests);
//fetch all canceled rides
router.get("/get-rejected-ride-rqs", authenticateToken,getRejectedRequests);

//add ratings for a ride
router.put("/add-ratings/:confirmedRideId", authenticateToken,updateRideRating);

//get ratings of a ride
router.get("/get-ratings/:confirmedRideId",authenticateToken, getRideRating);

router.get("/get-all-ratings", authenticateToken,getAllRatings);

router.get("/get-ride-by-user/:userId", authenticateToken,getLatestRideByUser);

router.put("/update-ride-cost/:rideId",authenticateToken, updateRideCost);


router.get("/get-started-rides-by-user/:userId", authenticateToken,getStartedRidesByUser);

router.get("/get-started-rides-by-driver/:driverId", authenticateToken,getStartedRidesByDriver);

router.get("/get-ended-rides-by-user/:userId", authenticateToken,getEndedRidesByUser);

router.get("/get-ended-rides-by-driver/:driverId", authenticateToken,getEndedRidesByDriver);




module.exports = router;
