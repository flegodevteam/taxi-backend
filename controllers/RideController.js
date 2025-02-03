const geolib = require("geolib");
const admin = require("firebase-admin");
const { firestore, realtimeDb } = require("../firebase/firebaseConfig");
const { calculateFullCost2 } = require("./CalculationController");
const axios = require("axios");

//Controller for send the ride requests using Push notitications
const sendRideRequest = async (driverId, rideDetails) => {
  try {
    // Check if vehicle_type is valid
    if (!rideDetails.whichVehicle) {
      throw new Error(`Vehicle type is undefined for driver ${driverId}`);
    }

    const { fullCost } = await calculateFullCost2({
      pickup_location: rideDetails.currentLocation,
      dropped_location: rideDetails.destinationLocation,
      vehicle_type: rideDetails.whichVehicle,
      waiting_time: 0,
    });

    // Function to get distance using Google Maps API
    const getGoogleMapsDistance = async (rideDetails) => {
      const { currentLocation, destinationLocation } = rideDetails;
      
      // Construct the URL for the Distance Matrix API request
      const googleMapsApiKey = 'AIzaSyCJkUwpCzeZDEB_WG8G6etP469AgEZwvs0'; // Store your API key in environment variables
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${currentLocation.latitude},${currentLocation.longitude}&destinations=${destinationLocation.latitude},${destinationLocation.longitude}&key=${googleMapsApiKey}&units=metric`;

      try {
        const response = await axios.get(url);
        
        if (response.data.status === "OK" && response.data.rows[0].elements[0].status === "OK") {
          const distance = response.data.rows[0].elements[0].distance.value / 1000; // Convert meters to km
          return distance;
        } else {
          throw new Error("Failed to get a valid response from Google Maps API");
        }
      } catch (error) {
        console.error("Error fetching distance from Google Maps API:", error);
        throw new Error("Error fetching distance from Google Maps API");
      }
    };

    // Await the result of getGoogleMapsDistance to resolve the promise
    const distance = await getGoogleMapsDistance(rideDetails);  // Awaiting the distance here
    console.log(`Calculated cost for ride: ${fullCost} (distance: ${distance.toFixed(2)} km)`);  // Now you have the actual value

    // Push the ride request details into Realtime Database
    const rideRequestsRef = realtimeDb.ref(`ride_requests/${driverId}`);

    await rideRequestsRef.push({
      rideId: rideDetails.rideId,
      currentLocation: rideDetails.currentLocation,
      destinationLocation: rideDetails.destinationLocation,
      status: "pending",
      createdAt: admin.database.ServerValue.TIMESTAMP,
      driverId: driverId,
      userEmail: rideDetails.userEmail,
      vehicle_type: rideDetails.whichVehicle, // Ensure this is not undefined
      userMobile: rideDetails.phoneNumber,
      userId: rideDetails.userId,
      cost: fullCost,
      distance: distance.toFixed(2), // Store the distance in km
    });

    // Get the FCM token for the driver
    const driverTokenRef = realtimeDb.ref(`drivers_tokens/${driverId}`);
    const driverTokenSnapshot = await driverTokenRef.once("value");

    if (!driverTokenSnapshot.exists()) {
      throw new Error(`No FCM token found for driver ${driverId}`);
    }

    const driverToken = driverTokenSnapshot.val();
    const messaging = admin.messaging();

    // Create the payload for the notification
    const payload = {
      notification: {
        title: "New Ride Request",
        body: "You have a new ride request. Open the app to accept or decline.",
      },
      data: {
        rideId: rideDetails.rideId,
        currentLocation: JSON.stringify(rideDetails.currentLocation),
        destinationLocation: JSON.stringify(rideDetails.destinationLocation),
      },
    };

    // Send the notification
    await messaging
      .send({
        token: driverToken,
        notification: payload.notification,
        data: payload.data,
      })
      .then((response) => {
        console.log("Successfully sent message:", response);
      })
      .catch((error) => {
        console.error("Error sending message:", error);
      });

    console.log(`Push notification sent to driver: ${driverId}`);
    return { message: "Ride request sent successfully." };
  } catch (error) {
    console.error(`Error sending ride request to driver ${driverId}:`, error.message);
    throw new Error("Error sending ride request: " + error.message);
  }
};




const requestRide = async (req, res) => {
  try {
    const { latitude, longitude, whichVehicle, destination, userEmail,userId,phoneNumber } =
      req.body;

    if (!latitude || !longitude || !destination || !userEmail ||!userId ||!phoneNumber) {
      console.log("Error: Missing required fields");
      return res
        .status(400)
        .send({
          error:
            "Latitude, longitude, destination,userId,phoneNumber and userEmail are required.",
        });
    }

    const currentLocation = { latitude, longitude };
    const destinationLocation = destination;
    const rideId = `RIDE${Date.now()}`;

    const db = admin.firestore();
    //console.log("Step 1: Fetching approved drivers with isAdminApprove = true");

    // Step 1: Fetch approved drivers with 'isAdminApprove' = 'approved'
const approvedDriversSnapshot = await db
.collection("drivers_personal_data")
.where("isAdminApprove", "==", "approved") // Changed from `true` to `"approved"`
.get();

    if (approvedDriversSnapshot.empty) {
      console.log("No approved drivers found.");
      return res
        .status(404)
        .send({ message: "No approved drivers available." });
    }

   // console.log("Approved drivers found:", approvedDriversSnapshot.docs.length);
    // Extract emails of approved drivers
    const approvedDriverEmails = approvedDriversSnapshot.docs.map(
      (doc) => doc.id
    );

   // console.log("Step 2: Fetching active drivers with isActive = true");

    // Step 2: Fetch active drivers with 'isActive' = true and match with approved driver emails
    const activeDriversSnapshot = await db
      .collection("drivers_location")
      .where("isActive", "==", true)
      .get();

    if (activeDriversSnapshot.empty) {
      console.log("No active drivers found.");
      return res.status(404).send({ message: "No active drivers available." });
    }

   // console.log("Active drivers found:", activeDriversSnapshot.docs.length);
    const activeApprovedDrivers = activeDriversSnapshot.docs.filter((doc) =>
      approvedDriverEmails.includes(doc.id)
    );

    if (activeApprovedDrivers.length === 0) {
      console.log("No drivers match the active and approved criteria.");
      return res
        .status(404)
        .send({ message: "No active drivers match the approved criteria." });
    }

    // console.log(
    //   "Active and approved drivers found:",
    //   activeApprovedDrivers.length
    // );

    // console.log(
    //   "Step 3: Checking payment status of the active and approved drivers"
    // );

    // Step 3: Check 'payment_Status' of the active and approved drivers
    const finalDrivers = await Promise.all(
      activeApprovedDrivers.map(async (doc) => {

        // console.log("doc",doc) 

        const driverEmail = doc.id;
        const driverPersonalData = await db
          .collection("drivers_personal_data")
          .doc(driverEmail)
          .get();

        if (
          driverPersonalData.exists &&
          driverPersonalData.data().payment_Status === true
        ) {
          return {
            email: driverEmail,
            current_location: doc.data().current_location,
            whichVehicle: driverPersonalData.data().whichVehicle || null,
          };
        }
        return null;
      })
    );

    // Remove null entries
    const eligibleDrivers = finalDrivers.filter((driver) => driver !== null);

    //console.log("Eligible drivers:", eligibleDrivers.length);

    if (eligibleDrivers.length === 0) {
      console.log("No drivers match the payment status criteria.");
      return res
        .status(404)
        .send({ message: "No drivers match the payment status criteria." });
    }

    //console.log("Step 4: Filtering drivers within 5km radius");

    // Step 4: Filter drivers within 5km radius
    const driversWithin5km = eligibleDrivers.filter((driver) => {
      if (!driver.current_location) return false;
      const driverLocation = {
        latitude: driver.current_location.latitude,
        longitude: driver.current_location.longitude,
      };
      return geolib.getDistance(currentLocation, driverLocation) <= 5000;
    });

    // console.log("Drivers within 5km:", driversWithin5km);

    // console.log("Step 5: Filtering drivers based on vehicle type");

    // // Step 5: Filtering drivers based on the specified vehicle type if available
    // console.log("Step 5: Filtering drivers based on vehicle type.");
    // console.log("Requested vehicle type:", whichVehicle);

    // Function to get vehicle type from the 'drivers_vehicle_data' collection
    const getVehicleTypeFromVehicleData = async (driverEmail) => {
      try {
        const vehicleDataDoc = await db
          .collection("drivers_vehicle_data")
          .doc(driverEmail)
          .get();
        if (!vehicleDataDoc.exists) {
          console.log(`No vehicle data found for driver ${driverEmail}`);
          return null; // No vehicle data found
        }
        const vehicleData = vehicleDataDoc.data();
        console.log(
          `Fetched vehicle data for driver ${driverEmail}:`,
          vehicleData
        );
        return vehicleData.whichVehicle || null; // Accessing 'whichVehicle' directly
      } catch (error) {
        console.error(
          "Error fetching vehicle data for driver:",
          driverEmail,
          error.message
        );
        return null;
      }
    };

    // Filter drivers based on the vehicle type
    const filteredDrivers = [];

    for (const driver of driversWithin5km) {
      // console.log(
      //   "Checking driver:",
      //   driver.email,
      //   "Vehicle:",
      //   driver.whichVehicle
      // );

      let driverVehicleType = driver.whichVehicle;

      // If vehicle type is null, fetch it from 'drivers_vehicle_data'
      if (!driverVehicleType) {
        driverVehicleType = await getVehicleTypeFromVehicleData(driver.email);
        // console.log(
        //   "Fetched vehicle type for driver",
        //   driver.email,
        //   ":",
        //   driverVehicleType
        // );
      }

      // Now filter based on the vehicle type (if whichVehicle was provided)
      if (
        whichVehicle &&
        driverVehicleType &&
        driverVehicleType.toLowerCase() === whichVehicle.toLowerCase()
      ) {
        filteredDrivers.push(driver);
      } else if (!whichVehicle) {
        filteredDrivers.push(driver); // If no specific vehicle type is required, add all drivers
      }
    }

   // console.log("Filtered drivers:", filteredDrivers);

    if (filteredDrivers.length === 0) {
      console.log("No drivers match the final criteria.");
      return res
        .status(404)
        .send({
          message: "No drivers found within range or matching vehicle type.",
        });
    }

    // console.log(
    //   "Filtered drivers based on vehicle type:",
    //   filteredDrivers.length
    // );

   // console.log("Step 6: Sorting drivers by proximity");

    // Step 6: Sort drivers by proximity and send ride requests
    const sortedDrivers = filteredDrivers
      .sort(
        (a, b) =>
          geolib.getDistance(currentLocation, a.current_location) -
          geolib.getDistance(currentLocation, b.current_location)
      )
      .slice(0, 5);

    //console.log("Sorted drivers (top 5):", sortedDrivers.length);

    const sentRequests = [];
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let lastSentTime = Date.now();

    // Send the first request immediately
    const firstDriver = sortedDrivers[0];
    console.log("vehicle before",whichVehicle)

    const rideDetails = {
      rideId,
      userEmail,
      userId,phoneNumber,
      currentLocation,
      destinationLocation,
      whichVehicle,

    };

    //console.log("firstDriver",firstDriver)

    try {
      console.log(`Sending request to first driver: ${firstDriver.email}`);
      await sendRideRequest(firstDriver.email, rideDetails);
      sentRequests.push({
        driverEmail: firstDriver.email,
        status: "Request sent",
      });

     // console.log("phoneNumber",phoneNumber)
      // Save the ride request to Firestore with userEmail
      const requestPayload = {
        rideId,
        userEmail,
        userId,phoneNumber,
        driverEmail: firstDriver.email,
        driverId: driverId,
        status: "Request sent",
        currentLocation,
        destinationLocation,
        whichVehicle,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      //console.log("request payload:", requestPayload);

      await db.collection("ride_requests").add(requestPayload);
    } catch (error) {
      console.error(
        `Error sending request to driver ${firstDriver.email}:`,
        error.message
      );
    }

    // Send ride requests to remaining drivers with a delay
    for (let i = 1; i < sortedDrivers.length; i++) {
      const driver = sortedDrivers[i];

      const currentTime = Date.now();
      const timeElapsed = currentTime - lastSentTime;
      if (timeElapsed < 3000) {
        await delay(3000 - timeElapsed);
      }

      try {
        console.log(`Sending request to driver: ${driver.email}`);
        await sendRideRequest(driver.email, rideDetails);
        sentRequests.push({
          driverEmail: driver.email,
          status: "Request sent",
        });

        lastSentTime = Date.now();
      } catch (error) {
        console.error(
          `Error sending request to driver ${driver.email}:`,
          error.message
        );
      }
    }

    res.send({
      message: "Ride request sent to nearest drivers.",
      sentRequests,
      destination: destinationLocation,
    });
  } catch (error) {
    console.error("Error in sendRideRequestToFilteredDrivers:", error.message);
    res.status(500).send({ error: error.message });
  }
};

// Initialize Firestore
const db = admin.database();



const handleRideRequest = async (req, res) => {
    const { driverId } = req.params;
    const { action, rideId } = req.body;
  
    // Step 1: Validate request parameters
    // console.log(
    //   `Received request: driverId=${driverId}, action=${action}, rideId=${rideId}`
    // );
  
    if (!driverId || !action || !rideId) {
      return res.status(400).json({
        error: "Missing required parameters: driverId, action or rideId.",
      });
    }
  
    if (action !== "accept" && action !== "reject") {
      return res.status(400).json({
        error: "Invalid action. Use 'accept' or 'reject'.",
      });
    }
  
    try {
      const rideRequestRef = admin.database().ref("ride_requests");
  
      // Step 2: Fetch ride requests for the given driverId
      const driverRequestsSnapshot = await rideRequestRef
        .child(driverId)
        .once("value");
  
      if (!driverRequestsSnapshot.exists()) {
        console.log(`No ride requests found for driver: ${driverId}`);
        return res
          .status(404)
          .json({ message: "No ride requests found for the specified driver." });
      }
  
      // Step 3: Find the matching ride request
      const driverRequests = driverRequestsSnapshot.val();
      let correctRideRequest = null;
      let correctRideKey = null;
  
      for (const [key, rideRequest] of Object.entries(driverRequests)) {
        if (rideRequest.rideId === rideId) {
          correctRideRequest = rideRequest;
          correctRideKey = key;
          break;
        }
      }
  
      console.log("correctRideRequest", correctRideRequest);
  
      // Step 4: Handle case where no matching ride request is found
      if (!correctRideRequest) {
        console.log(
          `No matching ride request found with rideId: ${rideId} for driver: ${driverId}`
        );
        return res.status(404).json({
          message: `No matching ride request found with rideId: ${rideId} for driver: ${driverId}.`,
        });
      }
  
      // Step 5: Perform the action (accept or reject)
      if (action === "accept") {
        console.log("Accepting the ride request...");
  
        // Step 1: Remove all requests for the driver
        await rideRequestRef.child(driverId).remove();
        console.log("Deleted all ride requests for the accepting driver.");
  
        // Step 2: Remove this rideId from all other drivers' ride requests
        const allRideRequestsSnapshot = await rideRequestRef.once("value");
        if (allRideRequestsSnapshot.exists()) {
          const allRideRequests = allRideRequestsSnapshot.val();
  
          for (const [otherDriverId, rides] of Object.entries(allRideRequests)) {
            for (const [key, rideRequest] of Object.entries(rides)) {
              if (rideRequest.rideId === rideId) {
                await rideRequestRef.child(otherDriverId).child(key).remove();
                console.log(
                  `Deleted ride request with rideId: ${rideId} for driver: ${otherDriverId}`
                );
              }
            }
          }
        }
  
        // Step 3: Save the accepted ride as a new document in Firestore
        const rideDataToSave = {
          confirmedRideId: rideId,
          userEmail: correctRideRequest.userEmail,
          vehicle_type: correctRideRequest.vehicle_type,
          driverId: correctRideRequest.driverId,
          pickupLocation: correctRideRequest.currentLocation,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          rideStatus: "driver accepted",
          rideStartedLocation: null,
          rideStartedTime: null,
          rideEndedLocation: null,
          rideEndedTime: null,
          far_of_ride: null,
          ride_time: null,
          waiting_time_started: null,
          waiting_time_ended: null,
          waiting_time: null,
          ratings: null,
          cost:correctRideRequest.cost,
          distance:correctRideRequest.distance,
          userId:correctRideRequest.userId,
          userMobile:correctRideRequest.userMobile,
        };
  
        await admin.firestore().collection("rides").add(rideDataToSave);
        console.log("New ride created successfully in Firestore.");
  
        const currentDateTime = new Date();
        const timestamp = currentDateTime.toISOString();
  
        // Save to 'accepted_requests' collection
        const acceptedRequestData = {
          rideId,
          driverId,
          status: "accepted",
          timestamp,
        };
  
        await admin
          .firestore()
          .collection("accepted_requests")
          .add(acceptedRequestData);
        console.log("Ride request recorded in accepted_requests collection.");
  
        return res.status(200).json({
          message: "Ride request accepted and new ride created successfully.",
          rideId,
        });
      } else if (action === "reject") {
        console.log("Rejecting the ride request...");
  
        // Remove the specific ride request
        await rideRequestRef.child(driverId).child(correctRideKey).remove();
        console.log(`Ride request with rideId: ${rideId} rejected successfully.`);
  
        const currentDateTime = new Date();
        const timestamp = currentDateTime.toISOString();
  
        // Save to 'rejected_requests' collection
        const rejectedRequestData = {
          rideId,
          driverId,
          status: "rejected",
          timestamp,
        };
  
        await admin
          .firestore()
          .collection("rejected_requests")
          .add(rejectedRequestData);
        console.log("Ride request recorded in rejected_requests collection.");
  
        return res.status(200).json({
          message: "Ride request rejected successfully.",
          rideId,
        });
      }
    } catch (error) {
      console.error("Error handling ride request:", error.message, error.stack);
      return res.status(500).json({
        error: "Internal server error. Please try again later.",
      });
    }
  };
  

const updateWaitingTime = async (req, res) => {
  const { confirmedRideId } = req.params;
  const { action } = req.body;

  // Validate input
  if (!confirmedRideId || !action) {
    return res.status(400).json({
      error: "Missing required parameters: confirmedRideId or action.",
    });
  }

  if (action !== "start" && action !== "end") {
    return res.status(400).json({
      error: "Invalid action. Use 'start' or 'end'.",
    });
  }

  try {
    const ridesRef = admin.firestore().collection("rides");

    // Fetch all documents in the 'rides' collection
    const allRidesSnapshot = await ridesRef.get();

    // Find the correct ride document that matches the confirmedRideId
    const rideDoc = allRidesSnapshot.docs.find(
      (doc) => doc.data().confirmedRideId === confirmedRideId
    );

    if (!rideDoc) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    const rideData = rideDoc.data();

    // Check if the rideStatus is 'ended'
    if (rideData.rideStatus === "ended") {
      return res.status(400).json({
        error: "Cannot update waiting time for an ended ride.",
      });
    }

    if (action === "start") {
      // Update waiting_time_started with current time
      await ridesRef.doc(rideDoc.id).update({
        waiting_time_started: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        message: "Waiting time started successfully.",
      });
    } else if (action === "end") {
      // Update waiting_time_ended with current time
      await ridesRef.doc(rideDoc.id).update({
        waiting_time_ended: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Fetch updated ride data
      const updatedRideDoc = await ridesRef.doc(rideDoc.id).get();
      const updatedRideData = updatedRideDoc.data();

      if (
        updatedRideData.waiting_time_started &&
        updatedRideData.waiting_time_ended
      ) {
        // Calculate waiting time in minutes
        const waitingTimeStarted =
          updatedRideData.waiting_time_started.toDate();
        const waitingTimeEnded = updatedRideData.waiting_time_ended.toDate();
        const waitingTimeMinutes = Math.ceil(
          (waitingTimeEnded - waitingTimeStarted) / 60000
        ); // Convert ms to minutes

        // Update the waiting_time field
        await ridesRef
          .doc(rideDoc.id)
          .update({ waiting_time: waitingTimeMinutes });

        return res.status(200).json({
          message: "Waiting time ended and calculated successfully.",
          waiting_time: waitingTimeMinutes,
        });
      } else {
        return res.status(400).json({
          error:
            "Cannot calculate waiting time. Ensure both start and end times are set.",
        });
      }
    }
  } catch (error) {
    console.error("Error updating waiting time:", error.message, error.stack);
    return res.status(500).json({
      error: "Internal server error. Please try again later.",
    });
  }
};

//get ride details by rideId.
const getRideDetails = async (req, res) => {
  try {
    // Step 1: Extract the rideId from the request query or body
    const { rideId } = req.params; // Assuming rideId is passed as a route parameter

    if (!rideId) {
      return res.status(400).json({
        message: "Missing rideId in the request.",
      });
    }

    console.log(`Fetching ride details for rideId: ${rideId}`);

    // Step 2: Query Firestore for the ride with the given rideId (confirmedRideId)
    const ridesCollection = admin.firestore().collection("rides");
    const querySnapshot = await ridesCollection
      .where("confirmedRideId", "==", rideId)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No ride found with the provided rideId.",
      });
    }

    // Step 3: Extract and return ride details
    const rideDetails = querySnapshot.docs[0].data(); // Assuming one ride per rideId
    return res.status(200).json({
      message: "Ride details fetched successfully.",
      rideDetails,
    });
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({
      message: "Failed to fetch ride details.",
      error: error.message,
    });
  }
};



// Driver responds to the ride request
const respondToRideRequest = async (req, res) => {
  try {
    const { requestId, response } = req.body;

    if (!requestId || !response) {
      return res
        .status(400)
        .send({ error: "Request ID and response are required." });
    }

    if (!["accepted", "declined"].includes(response)) {
      return res
        .status(400)
        .send({ error: "Response must be either 'accepted' or 'declined'." });
    }

    const db = admin.firestore();
    const requestRef = db.collection("ride_requests").doc(requestId);

    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).send({ error: "Ride request not found." });
    }

    // Update the request status
    await requestRef.update({
      status: response,
      responseTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send({ message: `Ride request ${response}.` });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};


const getRideRequestsForDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).send({ error: "Driver ID is required." });
    }

    const db = admin.database();
    const requestsSnapshot = await db.ref("ride_requests").once("value");

    if (!requestsSnapshot.exists()) {
      return res.status(404).send({ message: "No ride requests found." });
    }

    console.log("Fetched ride requests:", requestsSnapshot.val());

    const driverRideRequests = [];

    requestsSnapshot.forEach((driverSnapshot) => {
      if (driverSnapshot.key === driverId) {
        driverSnapshot.forEach((rideRequestSnapshot) => {
          const rideRequest = rideRequestSnapshot.val();
          if (rideRequest.status === "pending") {
            driverRideRequests.push(rideRequest);
          }
        });
      }
    });

    if (driverRideRequests.length === 0) {
      return res.status(404).send({
        message: `No pending ride requests found for driver: ${driverId}.`,
      });
    }

    res.status(200).setHeader("Content-Type", "application/json");

    let index = 0;

    const interval = setInterval(() => {
      if (index >= driverRideRequests.length) {
        clearInterval(interval);
        res.end(); // Close the connection after all ride requests are sent
        return;
      }

      res.write(
        JSON.stringify({
          message: "Ride request",
          rideRequest: driverRideRequests[index],
        }) + "\n"
      );

      index++; // Move to the next ride request
    }, 5000);

    // Send the first ride request immediately
    res.write(
      JSON.stringify({
        message: "Ride request",
        rideRequest: driverRideRequests[index],
      }) + "\n"
    );

    index++; // Move to the next ride request

  } catch (error) {
    console.error("Error fetching ride requests:", error.message);
    res.status(500).send({ error: error.message });
  }
}

  

const updateRideStatus = async (req, res) => {
  const { rideId } = req.params; // Get rideId from URL parameter
  const { action, latitude, longitude } = req.body; // Get action ('start' or 'end') and new location from the request body

  try {
    if (!rideId) {
      return res.status(400).json({
        message: "Missing rideId in the request.",
      });
    }

    console.log(`Fetching ride details for rideId: ${rideId}`);

    // Query Firestore for the ride with the given rideId (confirmedRideId)
    const ridesCollection = admin.firestore().collection("rides");
    const querySnapshot = await ridesCollection
      .where("confirmedRideId", "==", rideId)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No ride found with the provided rideId.",
      });
    }

    // Extract the ride document data
    const rideData = querySnapshot.docs[0].data(); // Assuming one ride per rideId
    console.log("Ride document data:", rideData);

    // Log the type of rideStartedTime to debug
    console.log("rideStartedTime type:", typeof rideData.rideStartedTime);
    console.log("rideStartedTime:", rideData.rideStartedTime);

    // Handle the ride update based on the action ('start' or 'end')
    const rideRef = ridesCollection.doc(querySnapshot.docs[0].id); // Get the reference of the ride document

    if (action === "start") {
      await rideRef.update({
        rideStartedLocation: { latitude: 8.555, longitude: 80.37 }, // Example location
        rideStartedTime: admin.firestore.FieldValue.serverTimestamp(),
        rideStatus: "started",
      });
      return res.status(200).send({ message: "Ride started successfully." });
    } else if (action === "end") {
      const rideEndedLocation = { latitude, longitude }; // Using the latitude and longitude from the request
      const rideEndedTime = admin.firestore.Timestamp.now(); // Get the actual current timestamp

      // Check if rideStartedTime exists and is an instance of Firestore Timestamp
      if (!(rideData.rideStartedTime instanceof admin.firestore.Timestamp)) {
        return res.status(400).send({ error: "Invalid ride start time." });
      }

      // Calculate distance and ride time (assuming you have helper functions for this)
      const distance = calculateDistance(
        rideData.rideStartedLocation,
        rideEndedLocation
      );
      const rideTime = calculateRideTime(
        rideData.rideStartedTime,
        rideEndedTime
      );

      await rideRef.update({
        rideEndedLocation,
        rideEndedTime, // Use the actual timestamp here
        rideStatus: "ended",
        far_of_ride: distance,
        ride_time: rideTime,
      });

      return res.status(200).send({ message: "Ride ended successfully." });
    } else {
      return res
        .status(400)
        .json({ error: "Invalid action. Must be 'start' or 'end'." });
    }
  } catch (error) {
    console.error("Error updating ride status:", error);
    return res.status(500).json({
      message: "Failed to update ride status.",
      error: error.message,
    });
  }
};

const getAllRidesByDate = async (req, res) => {
  const { date } = req.params; // Expecting date in format 'YYYY-MM-DD'

  if (!date) {
    return res.status(400).json({ error: "Missing required parameter: date." });
  }

  try {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const ridesRef = admin.firestore().collection("rides");
    const snapshot = await ridesRef
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .get();

    if (snapshot.empty) {
      return res
        .status(404)
        .json({ message: "No rides found for the given date." });
    }

    const rides = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ rides });
  } catch (error) {
    console.error("Error fetching rides by date:", error);
    return res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

// Function to calculate the distance between two coordinates (in kilometers)
const calculateDistance = (startLocation, endLocation) => {
  const lat1 = startLocation.latitude;
  const lon1 = startLocation.longitude;
  const lat2 = endLocation.latitude;
  const lon2 = endLocation.longitude;

  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in kilometers
};

// Helper function for calculating ride time
const calculateRideTime = (startTime, endTime) => {
  console.log("Start Time:", startTime);
  console.log("End Time:", endTime);

  if (
    !(startTime instanceof admin.firestore.Timestamp) ||
    !(endTime instanceof admin.firestore.Timestamp)
  ) {
    throw new Error("Invalid timestamps provided.");
  }

  const startMillis = startTime.toMillis(); // Convert to milliseconds
  const endMillis = endTime.toMillis(); // Convert to milliseconds

  const rideDurationMillis = endMillis - startMillis; // Duration in milliseconds

  // Convert milliseconds to minutes (1 minute = 60,000 milliseconds)
  const rideDurationMinutes = rideDurationMillis / 60000;

  return rideDurationMinutes; // Ride time in minutes
};

const getAcceptedRequests = async (req, res) => {
  try {
    // Access Firestore instance using admin.firestore() directly
    const acceptedRequestsRef = admin
      .firestore()
      .collection("accepted_requests");

    // Query the 'accepted_requests' collection where the status is 'accepted'
    const snapshot = await acceptedRequestsRef
      .where("status", "==", "accepted")
      .get();

    // Check if there are any documents
    if (snapshot.empty) {
      return res.status(404).json({ message: "No accepted requests found" });
    }

    // Extract the details of the documents
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Return the count and the details of the requests
    return res.status(200).json({
      count: requests.length,
      details: requests,
    });
  } catch (error) {
    console.error("Error fetching accepted requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller function to get rejected requests count and details
const getRejectedRequests = async (req, res) => {
  try {
    // Access Firestore instance using admin.firestore() directly
    const rejectedRequestsRef = admin
      .firestore()
      .collection("rejected_requests");

    // Query the 'rejected_requests' collection where the status is 'rejected'
    const snapshot = await rejectedRequestsRef
      .where("status", "==", "rejected")
      .get();

    // Check if there are any documents
    if (snapshot.empty) {
      return res.status(404).json({ message: "No rejected requests found" });
    }

    // Extract the details of the documents
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Return the count and the details of the requests
    return res.status(200).json({
      count: requests.length,
      details: requests,
    });
  } catch (error) {
    console.error("Error fetching rejected requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const updateRideRating = async (req, res) => {
  try {
    const { confirmedRideId } = req.params; // Get confirmedRideId from req.params
    const { ratings } = req.body; // Get ratings from req.body

    if (!confirmedRideId || ratings === undefined) {
      return res
        .status(400)
        .json({ message: "confirmedRideId and ratings are required." });
    }

    // Get a reference to the 'rides' collection
    const ridesRef = admin.firestore().collection("rides");

    // Query for the document with the specific 'confirmedRideId'
    const querySnapshot = await ridesRef
      .where("confirmedRideId", "==", confirmedRideId)
      .get();

    if (querySnapshot.empty) {
      return res
        .status(404)
        .json({
          message: `No ride found with confirmedRideId: ${confirmedRideId}`,
        });
    }

    // Update the 'ratings' field in the matching document
    querySnapshot.forEach(async (doc) => {
      await doc.ref.update({ ratings });
      console.log(
        `Ratings updated successfully for ride with ID: ${confirmedRideId}`
      );
    });

    return res.status(200).json({ message: "Ratings updated successfully." });
  } catch (error) {
    console.error("Error updating ratings:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while updating ratings.", error });
  }
};

const getRideRating = async (req, res) => {
  try {
    const { confirmedRideId } = req.params; // Get the confirmedRideId from the URL parameters

    if (!confirmedRideId) {
      return res.status(400).json({ message: "confirmedRideId is required." });
    }

    // Reference to the 'rides' collection
    const ridesRef = admin.firestore().collection("rides");

    // Query for the document with the specific 'confirmedRideId'
    const querySnapshot = await ridesRef
      .where("confirmedRideId", "==", confirmedRideId)
      .get();

    if (querySnapshot.empty) {
      return res
        .status(404)
        .json({
          message: `No ride found with confirmedRideId: ${confirmedRideId}`,
        });
    }

    // Retrieve the ratings field from the document
    let ratings;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      ratings = data.ratings; // Get the ratings value
    });

    return res.status(200).json({
      confirmedRideId,
      ratings: ratings !== undefined ? ratings : "Ratings not set yet.",
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while fetching ratings.", error });
  }
};

const getAllRatings = async (req, res) => {
  try {
    // Get a reference to the 'rides' collection
    const ridesRef = admin.firestore().collection("rides");

    // Fetch all documents in the 'rides' collection
    const querySnapshot = await ridesRef.get();

    if (querySnapshot.empty) {
      return res
        .status(404)
        .json({ message: "No rides found." });
    }

    // Prepare an array to hold all the ratings
    const ratings = [];

    // Loop through each ride document and push its ratings into the array
    querySnapshot.forEach(doc => {
      const rideData = doc.data();

      console.log("rideData",rideData)
      if (rideData.ratings) {
        ratings.push({
          confirmedRideId: rideData.confirmedRideId,
          ratings: rideData.ratings,
          driverId:rideData.driverId,
          userEmail:rideData.userEmail
        });
      }
    });

    // Return all ratings
    return res.status(200).json({ ratings });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    return res.status(500).json({ message: "An error occurred while fetching ratings.", error });
  }
};

const getLatestRideByUser = async (req, res) => {
  try {
    // Step 1: Extract the rideId from the request query or body
    const { userId } = req.params; // Assuming rideId is passed as a route parameter

    if (!userId) {
      return res.status(400).json({
        message: "Missing rideId in the request.",
      });
    }

    console.log(`Fetching ride details for rideId: ${userId}`);

    // Step 2: Query Firestore for the ride with the given rideId (confirmedRideId)
    const ridesCollection = admin.firestore().collection("rides");
    const querySnapshot = await ridesCollection
      .where("userId", "==", userId)
      .where("rideStatus", "==", "driver accepted")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No ride found with the provided userId.",
      });
    }

    // Step 3: Extract and return ride details
    const rideDetails = querySnapshot.docs[0].data(); // Assuming one ride per rideId


    return res.status(200).json({
      message: "Ride details fetched successfully.",
      rideDetails,
    });
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({
      message: "Failed to fetch ride details.",
      error: error.message,
    });
  }
};

const updateRideCost = async (req, res) => {
  const { rideId } = req.params; // Get rideId from URL parameter (assumed to be confirmedRideId)
  const { cost } = req.body; // Get the new cost from the request body

  try {
    if (!rideId) {
      return res.status(400).json({
        message: "Missing rideId in the request.",
      });
    }
    
    if (cost === undefined || cost === null) {
      return res.status(400).json({
        message: "Missing cost in the request body.",
      });
    }

    console.log(`Fetching ride details for rideId: ${rideId}`);

    // Query Firestore for the ride with the given confirmedRideId
    const ridesCollection = admin.firestore().collection("rides");
    const querySnapshot = await ridesCollection
      .where("confirmedRideId", "==", rideId)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No ride found with the provided rideId.",
      });
    }

    // Extract the ride document data (assuming one ride per rideId)
    const rideDoc = querySnapshot.docs[0];
    const rideData = rideDoc.data();
    console.log("Ride document data:", rideData);

    // Get a reference to the ride document
    const rideRef = ridesCollection.doc(rideDoc.id);

    // Update the cost field
    await rideRef.update({ cost });

    return res.status(200).json({ message: "Ride cost updated successfully." });
  } catch (error) {
    console.error("Error updating ride cost:", error);
    return res.status(500).json({
      message: "Failed to update ride cost.",
      error: error.message,
    });
  }
};

const getStartedRidesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    console.log(`Fetching started rides for userId: ${userId}`);

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given userId and have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("userId", "==", userId)
      .where("rideStatus", "==", "started")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found for the provided userId.",
      });
    }

    // Map through the results and collect ride data
    const rides = [];
    querySnapshot.forEach(doc => {
      rides.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({
      message: "Started rides fetched successfully.",
      rides,
    });
  } catch (error) {
    console.error("Error fetching started rides:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getStartedRidesByDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({ error: "driverId  is required." });
    }

    console.log(`Fetching started rides for driverId: ${driverId}`);

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given userId and have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("driverId", "==", driverId)
      .where("rideStatus", "==", "started")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found for the provided userId.",
      });
    }

    // Map through the results and collect ride data
    const rides = [];
    querySnapshot.forEach(doc => {
      rides.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({
      message: "Started rides fetched successfully.",
      rides,
    });
  } catch (error) {
    console.error("Error fetching started rides:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getEndedRidesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    console.log(`Fetching started rides for userId: ${userId}`);

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given userId and have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("userId", "==", userId)
      .where("rideStatus", "==", "ended")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found for the provided userId.",
      });
    }

    // Map through the results and collect ride data
    const rides = [];
    querySnapshot.forEach(doc => {
      rides.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({
      message: "Started rides fetched successfully.",
      rides,
    });
  } catch (error) {
    console.error("Error fetching started rides:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getEndedRidesByDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({ error: "driverId  is required." });
    }

    console.log(`Fetching started rides for driverId: ${driverId}`);

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given userId and have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("driverId", "==", driverId)
      .where("rideStatus", "==", "ended")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found for the provided userId.",
      });
    }

    // Map through the results and collect ride data
    const rides = [];
    querySnapshot.forEach(doc => {
      rides.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({
      message: "Started rides fetched successfully.",
      rides,
    });
  } catch (error) {
    console.error("Error fetching started rides:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = {
  getAcceptedRequests,
  requestRide,
  sendRideRequest,
  respondToRideRequest,
  handleRideRequest,
  getRideRequestsForDriver,
  updateWaitingTime,
  getRideDetails,
  updateRideStatus,
  getAllRidesByDate,
  getRejectedRequests,
  updateRideRating,
  getRideRating,
  getAllRatings,
  getLatestRideByUser,
  updateRideCost,
  getStartedRidesByUser,
  getStartedRidesByDriver,
  getEndedRidesByDriver,
  getEndedRidesByUser
};
