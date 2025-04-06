const geolib = require("geolib");
const admin = require("firebase-admin");
const { firestore, realtimeDb } = require("../firebase/firebaseConfig");
const { calculateFullCost2 } = require("./CalculationController");
const axios = require("axios");
require("dotenv").config();




//Controller for send the ride requests using Push notitications
const sendRideRequest = async (driverId, rideDetails) => {
  try {
    // Check if vehicle_type is valid
    if (!rideDetails.whichVehicle) {
      throw new Error(`Vehicle type is undefined for driver ${driverId}`);
    }

    // const { fullCost } = await calculateFullCost2({
    //   pickup_location: rideDetails.currentLocation,
    //   dropped_location: rideDetails.destinationLocation,
    //   vehicle_type: rideDetails.whichVehicle,
    //   waiting_time: 0,
    // });

    
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY; 

   // Function to validate latitude & longitude
const validateCoordinates = (latitude, longitude) => {
  return typeof latitude === "number" && typeof longitude === "number" &&
         latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

const getGoogleMapsDistance = async (rideDetails) => {
  const { currentLocation, destinationLocation } = rideDetails;

  // Validate input coordinates
  if (!validateCoordinates(currentLocation.latitude, currentLocation.longitude) ||
      !validateCoordinates(destinationLocation.latitude, destinationLocation.longitude)) {
    console.error("Invalid coordinates:", currentLocation, destinationLocation);
    throw new Error("Invalid coordinates provided.");
  }

 
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${currentLocation.latitude},${currentLocation.longitude}&destinations=${destinationLocation.latitude},${destinationLocation.longitude}&mode=driving&key=${googleMapsApiKey}`;

  try {
    const response = await axios.get(url);
    console.log("Google Maps API Response:", JSON.stringify(response.data, null, 2));

    // Check API response validity
    if (response.data.status !== "OK") {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const element = response.data.rows[0]?.elements[0];
    
    if (!element || element.status !== "OK") {
      throw new Error(`No valid route found. API Response: ${JSON.stringify(response.data)}`);
    }

    return element.distance.value / 1000; // Convert meters to km
  } catch (error) {
    console.error("Error fetching distance from Google Maps API:", error.message);
    throw new Error("Error fetching distance from Google Maps API");
  }
};
    
    
    

    // Await the result of getGoogleMapsDistance to resolve the promise
    const distance = await getGoogleMapsDistance(rideDetails);  // Awaiting the distance here
    //const distance = 0; 
    const distanceInKm = distance.toFixed(2)
    const { fullCost } = await calculateFullCost2({
      distanceInKm,
      vehicle_type: rideDetails.whichVehicle,
      waiting_time: 0,
    });

    console.log(`Calculated cost for ride: ${fullCost} (distance: ${distance.toFixed(2)} km)`);  // Now you have the actual value

    // Push the ride request details into Realtime Database
    const rideRequestsRef = realtimeDb.ref(`ride_requests/${driverId}`);

    const userName = await getUserName(rideDetails.userId);
    const userMobileNumber = await getUserMobile(rideDetails.userId);

    console.log("user userMobileNumber",userMobileNumber)
    await rideRequestsRef.push({
      rideId: rideDetails.rideId,
      currentLocation: rideDetails.currentLocation,
      destinationLocation: rideDetails.destinationLocation,
      status: "pending",
      createdAt: admin.database.ServerValue.TIMESTAMP,
      driverId: driverId,
      //userEmail: rideDetails.userEmail,
      vehicle_type: rideDetails.whichVehicle, // Ensure this is not undefined
      userMobile: userMobileNumber,
      userName:userName,
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

const getUserName = async (userId) => {
  try {
    const userRef = admin
      .firestore()
      .collection("users")
      .doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`No user found with ID: ${userId}`);
      return null;
    }

    const userData = userDoc.data();
    const userName = `${userData.firstName} ${userData.lastName}`;
    return userName;
  } catch (error) {
    console.error("Error fetching user details:", error);
    return null;
  }
};
const getUserMobile = async (userId) => {
  try {
    const userRef = admin
      .firestore()
      .collection("users")
      .doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`No user found with ID: ${userId}`);
      return null;
    }

    const userData = userDoc.data();
    const userMobile =userData.phoneNumber;
    return userMobile;
  } catch (error) {
    console.error("Error fetching user details:", error);
    return null;
  }
};


// const requestRide = async (req, res) => {
//   try {
//     const { latitude, longitude, whichVehicle, destination, userId, phoneNumber } = req.body;

//     if (!latitude || !longitude || !destination  || !userId || !phoneNumber) {
//       console.log("Error: Missing required fields");
//       return res.status(400).send({
//         error: "Latitude, longitude, destination, userId, phoneNumber, and userEmail are required.",
//       });
//     }

//     const currentLocation = { latitude, longitude };
//     const destinationLocation = destination;
//     const rideId = `RIDE${Date.now()}`;
//     const preRideId = `PRERIDE${Date.now()}`;

//     const db = admin.firestore();

//     // **Step 1: Save the ride request to 'preRideRequest' before processing**
//     const preRideRequestRef = db.collection("preRideRequest").doc(preRideId);
//     await preRideRequestRef.set({
//       preRideId,
//       rideId,
      
//       userId,
//       phoneNumber,
//       currentLocation,
//       destinationLocation,
//       whichVehicle,
//       status: "Processing", // Initial status
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//     });

//     console.log(`✅ Ride request successfully saved! PreRideId: ${preRideId}, UserId: ${userId}`);

//      // **Function to check if ride is canceled**
//      const checkIfCanceled = async () => {
//       const preRideDoc = await preRideRequestRef.get();
//       if (preRideDoc.exists && preRideDoc.data().status === "Canceled") {
//         console.log("Ride request was canceled before proceeding.");
//         throw new Error("Ride request has been canceled.");
//       }
//     };

//     // **Step 2: Initialize search parameters**
//     let searchRadius = 5000; // Start with a 5km radius
//     const maxRadius = 20000; // Maximum search limit
//     let driversWithin5km = [];

//     // **Step 3: Fetch drivers and filter in a loop**
//     while (searchRadius <= maxRadius) {

//       await checkIfCanceled();
//       // Fetch available drivers
//       const approvedDriversSnapshot = await db
//         .collection("drivers_personal_data")
//         .where("isAdminApprove", "==", "approved")
//         .get();

//       if (approvedDriversSnapshot.empty) {
//         console.log("No approved drivers found.");
//         return res.status(404).send({ message: "No approved drivers available." });
//       }

//       const approvedDriverEmails = approvedDriversSnapshot.docs.map((doc) => doc.id);

//       const activeDriversSnapshot = await db
//         .collection("drivers_location")
//         .where("isActive", "==", true)
//         .get();

//       if (activeDriversSnapshot.empty) {
//         console.log("No active drivers found.");
//         return res.status(404).send({ message: "No active drivers available." });
//       } 

//       const activeApprovedDrivers = activeDriversSnapshot.docs.filter((doc) =>
//         approvedDriverEmails.includes(doc.id)
//       );

//       if (activeApprovedDrivers.length === 0) {
//         console.log("No drivers match the active and approved criteria.");
//         return res.status(404).send({ message: "No active drivers match the approved criteria." });
//       }

//       // **Step 4: Check payment status of drivers**
//       const finalDrivers = await Promise.all(
//         activeApprovedDrivers.map(async (doc) => {
//           const driverEmail = doc.id;
//           const driverPersonalData = await db.collection("drivers_personal_data").doc(driverEmail).get();

//           if (driverPersonalData.exists && driverPersonalData.data().payment_Status === true) {
//             return {
//               email: driverEmail,
//               current_location: doc.data().current_location,
//               whichVehicle: driverPersonalData.data().whichVehicle || null,
//             };
//           }
//           return null;
//         })
//       );

//       await checkIfCanceled();

//       const eligibleDrivers = finalDrivers.filter((driver) => driver !== null);

//       // **Step 5: Filter drivers within the current search radius**
//       driversWithin5km = eligibleDrivers.filter((driver) => {
//         if (!driver.current_location) return false;
//         const driverLocation = {
//           latitude: driver.current_location.latitude,
//           longitude: driver.current_location.longitude,
//         };
//         return geolib.getDistance(currentLocation, driverLocation) <= searchRadius;
//       });

//       if (driversWithin5km.length > 0) {
//         console.log("Drivers found:", driversWithin5km);
//         break; // Exit the loop if drivers are found
//       } else {
//         console.log(`No drivers found within ${searchRadius / 1000} km. Expanding search...`);
//         searchRadius += 5000; // Increase radius by 5km

//         await checkIfCanceled();
//         // Wait for 1 minute before the next check
//         await new Promise(resolve => setTimeout(resolve, 60000)); // Optional: delay for 1 minute before the next search
//       }
//     }

//     if (driversWithin5km.length === 0) {
//       console.log("No drivers found within the maximum search radius.");
//       return res.status(404).send({ message: "No drivers found within range." });
//     }
    

//     // **Step 6: Filter drivers by vehicle type**
//     const getVehicleTypeFromVehicleData = async (driverEmail) => {
//       await checkIfCanceled();
//       try {
//         const vehicleDataDoc = await db.collection("drivers_vehicle_data").doc(driverEmail).get();
//         if (!vehicleDataDoc.exists) return null;
//         return vehicleDataDoc.data().whichVehicle || null;
//       } catch (error) {
//         console.error("Error fetching vehicle data for driver:", driverEmail, error.message);
//         return null;
//       }
//     };
    

//     const filteredDrivers = [];
//     for (const driver of driversWithin5km) {

//       await checkIfCanceled();

//       let driverVehicleType = driver.whichVehicle || (await getVehicleTypeFromVehicleData(driver.email));
//       if (whichVehicle && driverVehicleType && driverVehicleType.toLowerCase() === whichVehicle.toLowerCase()) {
//         filteredDrivers.push(driver);
//       } else if (!whichVehicle) {
//         filteredDrivers.push(driver);
//       }
//     }

//     if (filteredDrivers.length === 0) {
//       console.log("No drivers match the final criteria.");
//       return res.status(404).send({ message: "No drivers found matching vehicle type." });
//     }

//     // **Step 7: Sort drivers by proximity and send ride requests**
//     const sortedDrivers = filteredDrivers
//       .sort(
//         (a, b) =>
//           geolib.getDistance(currentLocation, a.current_location) -
//           geolib.getDistance(currentLocation, b.current_location)
//       )
//       .slice(0, 5);

//     const sentRequests = [];
//     const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//     let lastSentTime = Date.now();

//      await checkIfCanceled();

//     // **Send ride requests to top 5 drivers**
//     for (const driver of sortedDrivers) {

//       await checkIfCanceled();

//       const currentTime = Date.now();
//       const timeElapsed = currentTime - lastSentTime;
//       if (timeElapsed < 3000) {
//         await delay(3000 - timeElapsed);
//       }

//       try {
//         console.log(`Sending request to driver: ${driver.email}`);
//         await sendRideRequest(driver.email, {
//           rideId,
         
//           userId,
//           phoneNumber,
//           currentLocation,
//           destinationLocation,
//           whichVehicle,
//         });

//         sentRequests.push({ driverEmail: driver.email, status: "Request sent" });
//         lastSentTime = Date.now();
//       } catch (error) {
//         console.error(`Error sending request to driver ${driver.email}:`, error.message);
//       }
//     }

//     // Update status to "Proceed" in preRideRequest
//     await preRideRequestRef.update({
//       status: "Proceed",
//     });

//     res.send({
//       message: "Ride request sent to nearest drivers.",
//       sentRequests,
//       destination: destinationLocation,
//     });

//   } catch (error) {
//     console.error("Error in requestRide:", error.message);
//     res.status(500).send({ error: error.message });
//   }
// };

const getDriversWhoHaveRidesToday = async (db) => {
  console.log("📅 Fetching drivers who have completed rides today...");
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const ridesSnapshot = await db
    .collection("rides")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(today))
    .get();

  const driversWhoHaveRides = new Set();
  ridesSnapshot.forEach((doc) => {
    const rideData = doc.data();
    if (rideData.driverId) {
      driversWhoHaveRides.add(rideData.driverId);
    }
  });

  console.log(`✅ Found ${driversWhoHaveRides.size} drivers who have rides today.`);
  console.log("driversWhoHaveRides",driversWhoHaveRides)
  return driversWhoHaveRides;
};

const requestRide = async (req, res) => {
  try {
    console.log("🚀 Ride request received:", req.body);

    const { latitude, longitude, whichVehicle, destination, userId, phoneNumber } = req.body;
    if (!latitude || !longitude || !destination || !userId || !phoneNumber) {
      console.log("❌ Error: Missing required fields");
      return res.status(400).send({ error: "Required fields are missing." });
    }

    const db = admin.firestore();
    const currentLocation = { latitude, longitude };
    const destinationLocation = destination;
    const rideId = `RIDE${Date.now()}`;
    const preRideId = `PRERIDE${Date.now()}`;

    console.log("📝 Saving pre-ride request...");
    const preRideRequestRef = db.collection("preRideRequest").doc(preRideId);
    await preRideRequestRef.set({
      preRideId,
      rideId,
      userId,
      phoneNumber,
      currentLocation,
      destinationLocation,
      whichVehicle,
      status: "Processing",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Pre-ride request saved! PreRideId: ${preRideId}`);

     // **Function to check if ride is canceled**
     const checkIfCanceled = async () => {
      const preRideDoc = await preRideRequestRef.get();
      if (preRideDoc.exists && preRideDoc.data().status === "Canceled") {
        console.log("Ride request was canceled before proceeding.");
        throw new Error("Ride request has been canceled.");
      }
    };

    // Fetch drivers who already have rides today
    const driversWhoHaveRidesToday = await getDriversWhoHaveRidesToday(db);

    let searchRadius = 5000;
    const maxRadius = 20000;
    let driversWithin5km = [];

    while (searchRadius <= maxRadius) {
      await checkIfCanceled();
      console.log(`🔄 Searching for drivers within ${searchRadius / 1000} km...`);

      const approvedDriversSnapshot = await db
        .collection("drivers_personal_data")
        .where("isAdminApprove", "==", "approved")
        .get();

      if (approvedDriversSnapshot.empty) {
        console.log("❌ No approved drivers found.");
        return res.status(404).send({ message: "No approved drivers available." });
      }

      const approvedDriverEmails = approvedDriversSnapshot.docs.map((doc) => doc.id);
      console.log(`✅ Found ${approvedDriverEmails.length} approved drivers.`);

      const activeDriversSnapshot = await db
        .collection("drivers_location")
        .where("isActive", "==", true)
        .get();

      if (activeDriversSnapshot.empty) {
        console.log("❌ No active drivers found.");
        return res.status(404).send({ message: "No active drivers available." });
      }

      await checkIfCanceled();
      console.log(`✅ Found ${activeDriversSnapshot.docs.length} active drivers.`);

      const activeApprovedDrivers = activeDriversSnapshot.docs
        .filter((doc) => approvedDriverEmails.includes(doc.id))
        .map((doc) => ({
          email: doc.id,
          current_location: doc.data().current_location,
        }));

      console.log(`🔎 Found ${activeApprovedDrivers.length} drivers who are both active and approved.`);

      if (activeApprovedDrivers.length === 0) {
        console.log("❌ No drivers match the active and approved criteria.");
        return res.status(404).send({ message: "No active drivers match the approved criteria." });
      }

      await checkIfCanceled();
      console.log("💰 Filtering drivers by payment status...");
      const finalDrivers = await Promise.all(
        activeApprovedDrivers.map(async (driver) => {
          await checkIfCanceled();
          const driverPersonalData = await db.collection("drivers_personal_data").doc(driver.email).get();
          const driverVehicleData = await db.collection("drivers_vehicle_data").doc(driver.email).get();

          if (driverPersonalData.exists && driverPersonalData.data().payment_Status === true) {
            return {
              email: driver.email,
              current_location: driver.current_location,
              whichVehicle: driverVehicleData.exists ? driverVehicleData.data().whichVehicle : null,
            };
          }
          return null;
        })
      );

      await checkIfCanceled();
      const eligibleDrivers = finalDrivers.filter((driver) => driver !== null);
      console.log(`✅ Found ${eligibleDrivers.length} eligible drivers after payment status filtering.`);

      // Separate drivers who have rides today and drivers who don't
      const driversWithoutRidesToday = eligibleDrivers.filter(
        (driver) => !driversWhoHaveRidesToday.has(driver.email)
      );

      console.log(`🚗 Filtering out drivers with rides today. Remaining: ${driversWithoutRidesToday.length}`);

      const driversWithRidesToday = eligibleDrivers.filter(
        (driver) => driversWhoHaveRidesToday.has(driver.email)
      );

      console.log(`🚗 Found ${driversWithRidesToday.length} drivers with rides today.`);

      // Merge the lists: first drivers without rides, then those with rides
      const allDriversToSendRequest = [...driversWithoutRidesToday, ...driversWithRidesToday];

      if (allDriversToSendRequest.length === 0) {
        console.log("❌ No available drivers after filtering out those with rides today.");
        return res.status(404).send({ message: "No available drivers at the moment." });
      }
      await checkIfCanceled();

      // Step 5: Filter drivers within search radius
      driversWithin5km = allDriversToSendRequest.filter((driver) => {
        if (!driver.current_location) return false;
        const driverLocation = {
          latitude: driver.current_location.latitude,
          longitude: driver.current_location.longitude,
        };
        return geolib.getDistance(currentLocation, driverLocation) <= searchRadius;
      });

      console.log(`📍 Found ${driversWithin5km.length} drivers within ${searchRadius / 1000} km.`);
      await checkIfCanceled();

      if (driversWithin5km.length > 0) break;

      console.log(`🔍 No drivers within ${searchRadius / 1000} km. Expanding search...`);
      searchRadius += 5000;
      await new Promise((resolve) => setTimeout(resolve, 60000)); // 1-minute delay before rechecking
    }

    if (driversWithin5km.length === 0) {
      console.log("❌ No drivers found within the maximum search radius.");
      return res.status(404).send({ message: "No drivers found within range." });
    }

    await checkIfCanceled();
    console.log("🚗 Nearby drivers full data:", JSON.stringify(driversWithin5km, null, 2));

    // Sorting drivers by distance
    console.log("📌 Sorting drivers by distance...");
    const sortedDrivers = driversWithin5km
      .sort(
        (a, b) =>
          geolib.getDistance(currentLocation, a.current_location) -
          geolib.getDistance(currentLocation, b.current_location)
      )
      .slice(0, 5);

    console.log(`📨 Sending ride requests to ${sortedDrivers.length} nearest drivers...`);
    const sentRequests = [];
    let lastSentTime = Date.now();

    for (const driver of sortedDrivers) {
      await checkIfCanceled();
      const timeElapsed = Date.now() - lastSentTime;
      if (timeElapsed < 3000) await new Promise((resolve) => setTimeout(resolve, 3000 - timeElapsed));

      try {
        console.log(`📩 Sending request to driver: ${driver.email}`);
        await sendRideRequest(driver.email, { rideId, userId, phoneNumber, currentLocation, destinationLocation, whichVehicle });
        sentRequests.push({ driverEmail: driver.email, status: "Request sent" });
        lastSentTime = Date.now();
      } catch (error) {
        console.error(`❌ Error sending request to ${driver.email}:`, error.message);
      }
    }

    await checkIfCanceled();
    await preRideRequestRef.update({ status: "Proceed" });
    console.log("✅ Ride request process completed!");
    res.send({ message: "Ride request sent to nearest drivers.", sentRequests, destination: destinationLocation });

  } catch (error) {
    console.error("❌ Error in requestRide:", error.message);
    res.status(500).send({ error: error.message });
  }
};








const cancelRideRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    // const {  whichVehicle , phoneNumber } = req.body;

    const db = admin.firestore();

    // console.log("Cancel request for:", { userId, phoneNumber, latitude, longitude, destination, whichVehicle });

    const preRideQuery = await db
  .collection("preRideRequest")
  .where("userId", "==", userId)
  // .where("userEmail", "==", userEmail)
  // .where("phoneNumber", "==", phoneNumber)
  // .where("whichVehicle", "==", whichVehicle)
  .where("status", "==", "Processing")
  .get();


    console.log("Query result size:", preRideQuery.size);

    if (preRideQuery.empty) {
      console.log("No matching ride request found.");
      return res.status(404).send({ message: "No matching ride request found." });
    }

    const batch = db.batch();
    preRideQuery.forEach((doc) => batch.update(doc.ref, { status: "Canceled" }));
    await batch.commit();

    res.send({ message: "Ride request canceled successfully." });
  } catch (error) {
    console.error("Error canceling ride request:", error.message);
    res.status(500).send({ error: error.message });
  }
};




// const requestRide = async (req, res) => {
//   try {
//     const { latitude, longitude, whichVehicle, destination, userEmail,userId,phoneNumber } =
//       req.body;

//     if (!latitude || !longitude || !destination || !userEmail ||!userId ||!phoneNumber) {
//       console.log("Error: Missing required fields");
//       return res
//         .status(400)
//         .send({
//           error:
//             "Latitude, longitude, destination,userId,phoneNumber and userEmail are required.",
//         });
//     }

//     const currentLocation = { latitude, longitude };
//     const destinationLocation = destination;
//     const rideId = `RIDE${Date.now()}`;

//     const db = admin.firestore();
//     //console.log("Step 1: Fetching approved drivers with isAdminApprove = true");
//     const maxAttempts = 5; // Maximum number of attempts to find a driver
//     let attempt = 0;
//     let foundDriver = null;
//     let driversWithin5km = [];
//     while (attempt < maxAttempts && !foundDriver) {
//       attempt++;
//     // Step 1: Fetch approved drivers with 'isAdminApprove' = 'approved'
// const approvedDriversSnapshot = await db
// .collection("drivers_personal_data")
// .where("isAdminApprove", "==", "approved") // Changed from `true` to `"approved"`
// .get();

//     if (approvedDriversSnapshot.empty) {
//       console.log("No approved drivers found.");
//       return res
//         .status(404)
//         .send({ message: "No approved drivers available." });
//     }

//     ///console.log("approved drivers",approvedDriversSnapshot)
//    console.log("Approved drivers found:", approvedDriversSnapshot.docs.length);
//     // Extract emails of approved drivers
//     const approvedDriverEmails = approvedDriversSnapshot.docs.map(
//       (doc) => doc.id
//     );

//    // console.log("Step 2: Fetching active drivers with isActive = true");

//     // Step 2: Fetch active drivers with 'isActive' = true and match with approved driver emails
//     const activeDriversSnapshot = await db
//       .collection("drivers_location")
//       .where("isActive", "==", true)
//       .get();

//     if (activeDriversSnapshot.empty) {
//       console.log("No active drivers found.");
//       return res.status(404).send({ message: "No active drivers available." });
//     }

//    console.log("Active drivers found:", activeDriversSnapshot.docs.length);
//     const activeApprovedDrivers = activeDriversSnapshot.docs.filter((doc) =>
//       approvedDriverEmails.includes(doc.id)
//     );

    

//     if (activeApprovedDrivers.length === 0) {
//       console.log("No drivers match the active and approved criteria.");
//       return res
//         .status(404)
//         .send({ message: "No active drivers match the approved criteria." });
//     }

//     // console.log(
//     //   "Active and approved drivers found:",
//     //   activeApprovedDrivers.length
//     // );

//     // console.log(
//     //   "Step 3: Checking payment status of the active and approved drivers"
//     // );

//     // Step 3: Check 'payment_Status' of the active and approved drivers
//     const finalDrivers = await Promise.all(
//       activeApprovedDrivers.map(async (doc) => {

//          //console.log("doc",doc) 

//         const driverEmail = doc.id;
//         const driverPersonalData = await db
//           .collection("drivers_personal_data")
//           .doc(driverEmail)
//           .get();

//         if (
//           driverPersonalData.exists &&
//           driverPersonalData.data().payment_Status === true
//         ) {
//           return {
//             email: driverEmail,
//             current_location: doc.data().current_location,
//             whichVehicle: driverPersonalData.data().whichVehicle || null,
//           };
//         }
//         return null;
//       })
//     );

//     // Remove null entries
//     const eligibleDrivers = finalDrivers.filter((driver) => driver !== null);

//     console.log("Eligible drivers:", eligibleDrivers);

//     if (eligibleDrivers.length === 0) {
//       console.log("No drivers match the payment status criteria.");
//       // return res
//       //   .status(404)
//       //   .send({ message: "No drivers match the payment status criteria." });
//       await new Promise(resolve => setTimeout(resolve, 30000));
//         continue;
//     }

//     //console.log("Step 4: Filtering drivers within 5km radius");

//     // Step 4: Filter drivers within 5km radius
//     driversWithin5km = eligibleDrivers.filter((driver) => {
//       if (!driver.current_location) return false;
//       const driverLocation = {
//         latitude: driver.current_location.latitude,
//         longitude: driver.current_location.longitude,
//       };
//       return geolib.getDistance(currentLocation, driverLocation) <= 5000;
//     });

//     if (driversWithin5km.length === 0) {
//       console.log("No drivers found within 5km.");
//       // Optionally wait before retrying
//       await new Promise(resolve => setTimeout(resolve, 30000)); // Wait for 3 seconds before retrying
//       continue; // Retry the loop
//     }

//     // If we reach here, we have found eligible drivers within 5km
//     foundDriver = driversWithin5km[0]; // You can choose how to select the driver

//     // Proceed with sending the ride request to the found driver
//     // (Add your logic to send the ride request here)

//     // For demonstration, let's just log the found driver
//     console.log("Found driver:", foundDriver);
//   }

//   if (!foundDriver) {
//     return res.status(404).send({ message: "No suitable drivers found after multiple attempts." });
//   }

//     // console.log("Drivers within 5km:", driversWithin5km);

//     // console.log("Step 5: Filtering drivers based on vehicle type");

//     // // Step 5: Filtering drivers based on the specified vehicle type if available
//     // console.log("Step 5: Filtering drivers based on vehicle type.");
//     // console.log("Requested vehicle type:", whichVehicle);

//     // Function to get vehicle type from the 'drivers_vehicle_data' collection
//     const getVehicleTypeFromVehicleData = async (driverEmail) => {
//       try {
//         const vehicleDataDoc = await db
//           .collection("drivers_vehicle_data")
//           .doc(driverEmail)
//           .get();
//         if (!vehicleDataDoc.exists) {
//           console.log(`No vehicle data found for driver ${driverEmail}`);
//           return null; // No vehicle data found
//         }
//         const vehicleData = vehicleDataDoc.data();
//         console.log(
//           `Fetched vehicle data for driver ${driverEmail}:`,
//           vehicleData
//         );
//         return vehicleData.whichVehicle || null; // Accessing 'whichVehicle' directly
//       } catch (error) {
//         console.error(
//           "Error fetching vehicle data for driver:",
//           driverEmail,
//           error.message
//         );
//         return null;
//       }
//     };

//     // Filter drivers based on the vehicle type
//     const filteredDrivers = [];

//     for (const driver of driversWithin5km) {
//       // console.log(
//       //   "Checking driver:",
//       //   driver.email,
//       //   "Vehicle:",
//       //   driver.whichVehicle
//       // );

//       let driverVehicleType = driver.whichVehicle;

//       // If vehicle type is null, fetch it from 'drivers_vehicle_data'
//       if (!driverVehicleType) {
//         driverVehicleType = await getVehicleTypeFromVehicleData(driver.email);
//         // console.log(
//         //   "Fetched vehicle type for driver",
//         //   driver.email,
//         //   ":",
//         //   driverVehicleType
//         // );
//       }

//       // Now filter based on the vehicle type (if whichVehicle was provided)
//       if (
//         whichVehicle &&
//         driverVehicleType &&
//         driverVehicleType.toLowerCase() === whichVehicle.toLowerCase()
//       ) {
//         filteredDrivers.push(driver);
//       } else if (!whichVehicle) {
//         filteredDrivers.push(driver); // If no specific vehicle type is required, add all drivers
//       }
//     }

//    // console.log("Filtered drivers:", filteredDrivers);

//     if (filteredDrivers.length === 0) {
//       console.log("No drivers match the final criteria.");
//       return res
//         .status(404)
//         .send({
//           message: "No drivers found within range or matching vehicle type.",
//         });
//     }

//     // console.log(
//     //   "Filtered drivers based on vehicle type:",
//     //   filteredDrivers.length
//     // );

//    // console.log("Step 6: Sorting drivers by proximity");

//     // Step 6: Sort drivers by proximity and send ride requests
//     const sortedDrivers = filteredDrivers
//       .sort(
//         (a, b) =>
//           geolib.getDistance(currentLocation, a.current_location) -
//           geolib.getDistance(currentLocation, b.current_location)
//       )
//       .slice(0, 5);

//     //console.log("Sorted drivers (top 5):", sortedDrivers.length);

//     const sentRequests = [];
//     const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//     let lastSentTime = Date.now();

//     // Send the first request immediately
//     const firstDriver = sortedDrivers[0];
//     console.log("vehicle before",whichVehicle)

//     const rideDetails = {
//       rideId,
//       userEmail,
//       userId,phoneNumber,
//       currentLocation,
//       destinationLocation,
//       whichVehicle,

//     };

//     //console.log("firstDriver",firstDriver)

//     try {
//       console.log(`Sending request to first driver: ${firstDriver.email}`);
//       await sendRideRequest(firstDriver.email, rideDetails);
//       sentRequests.push({
//         driverEmail: firstDriver.email,
//         status: "Request sent",
//       });

//      // console.log("phoneNumber",phoneNumber)
//       // Save the ride request to Firestore with userEmail
//       const requestPayload = {
//         rideId,
//         userEmail,
//         userId,phoneNumber,
//         driverEmail: firstDriver.email,
//         driverId: firstDriver.email,
//         status: "Request sent",
//         currentLocation,
//         destinationLocation,
//         whichVehicle,
//         createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       };

//       //console.log("request payload:", requestPayload);

//       await db.collection("ride_requests").add(requestPayload);
//     } catch (error) {
//       console.error(
//         `Error sending request to driver -1 ${firstDriver.email}:`,
//         error.message
//       );
//     }

//     // Send ride requests to remaining drivers with a delay
//     for (let i = 1; i < sortedDrivers.length; i++) {
//       const driver = sortedDrivers[i];

//       const currentTime = Date.now();
//       const timeElapsed = currentTime - lastSentTime;
//       if (timeElapsed < 3000) {
//         await delay(3000 - timeElapsed);
//       }

//       try {
//         console.log(`Sending request to driver: ${driver.email}`);
//         await sendRideRequest(driver.email, rideDetails);
//         sentRequests.push({
//           driverEmail: driver.email,
//           status: "Request sent",
//         });

//         lastSentTime = Date.now();
//       } catch (error) {
//         console.error(
//           `Error sending request to driver ${driver.email}:`,
//           error.message
//         );
//       }
//     }

//     res.send({
//       message: "Ride request sent to nearest drivers.",
//       sentRequests,
//       destination: destinationLocation,
//     });
//   } catch (error) {
//     console.error("Error in sendRideRequestToFilteredDrivers:", error.message);
//     res.status(500).send({ error: error.message });
//   }
// };




// Initialize Firestore
const db = admin.database();


const getDriverName = async (driverId) => {
  try {
    const driverRef = admin
      .firestore()
      .collection("drivers_personal_data")
      .doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      console.log(`No driver found with ID: ${driverId}`);
      return null;
    }

    const driverData = driverDoc.data();
    const driverName = `${driverData.firstName} ${driverData.lastName}`;
    return driverName;
  } catch (error) {
    console.error("Error fetching driver details:", error);
    return null;
  }
};
const getDriverMobileNo = async (driverId) => {
  try {
    const driverRef = admin
      .firestore()
      .collection("drivers_personal_data")
      .doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      console.log(`No driver found with ID: ${driverId}`);
      return null;
    }

    const driverData = driverDoc.data();
    const driverMobile = driverData.telephone;
    return driverMobile;
  } catch (error) {
    console.error("Error fetching driver details:", error);
    return null;
  }
};



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
        const driverName = await getDriverName(correctRideRequest.driverId);
        const driverMobile = await getDriverMobileNo(correctRideRequest.driverId);
        // Step 3: Save the accepted ride as a new document in Firestore
        const rideDataToSave = {
          confirmedRideId: rideId,
         // userEmail: correctRideRequest.userEmail,
          vehicle_type: correctRideRequest.vehicle_type,
          driverId: correctRideRequest.driverId,
          pickupLocation: correctRideRequest.currentLocation,
          destinationLocation:correctRideRequest.destinationLocation,
          driverName: driverName || "Unknown Driver",
          driverMobileNo:driverMobile,
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

    req.on("close", () => {
      console.log("Client aborted the request.");
    });

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



const getRideRequestsForDriver = (ws, driverId) => {
  console.log(`Fetching ride requests for driver: ${driverId}`); // Debugging log

  if (!driverId) {
    ws.send(JSON.stringify({ error: "Driver ID is required." }));
    ws.close();
    return;
  }

  const db = admin.database();
  db.ref("ride_requests").once("value", (requestsSnapshot) => {
   // console.log("Ride requests snapshot:", requestsSnapshot.val()); // Debugging log

    if (!requestsSnapshot.exists()) {
      ws.send(JSON.stringify({ message: "No ride requests found." }));
      ws.close();
      return;
    }

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

    console.log("requestsSnapshot",requestsSnapshot)

    if (driverRideRequests.length === 0) {
      ws.send(JSON.stringify({ message: `No pending ride requests for driver: ${driverId}.` }));
      ws.close();
      return;
    }

    let index = 0;

    const sendNextRideRequest = () => {
      if (index >= driverRideRequests.length) {
        ws.close();
        return;
      }

      ws.send(
        JSON.stringify({
          message: "Ride request",
          rideRequest: driverRideRequests[index],
        })
      );

      index++;
      setTimeout(sendNextRideRequest, 5000); // Send next request after 5 seconds
    };

    sendNextRideRequest(); // Start sending requests
  }).catch((error) => {
    console.error("Error fetching ride requests:", error.message);
    ws.send(JSON.stringify({ error: error.message }));
    ws.close();
  });
};






  

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

    let driverId;
    
    // Update the 'ratings' field in the matching document and get driverId
    await Promise.all(
      querySnapshot.docs.map(async (doc) => {
        driverId = doc.data().driverId; // Extract driverId
        await doc.ref.update({ ratings });
      })
    );

    if (!driverId) {
      return res.status(400).json({ message: "Driver ID not found in ride data." });
    }

    // Reference to the driver's personal data collection
    const driverRef = admin
      .firestore()
      .collection("drivers_personal_data")
      .doc(driverId);

    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({ message: "Driver not found." });
    }

    const currentPoints = driverDoc.data().Points || 0; // Default to 0 if not set
    const updatedPoints = currentPoints + ratings; // Add new ratings to Points

    // Update driver's Points
    await driverRef.update({ Points: updatedPoints });

    return res.status(200).json({
      message: "Ratings and driver Points updated successfully.",
      driverId,
      updatedPoints,
    });
  } catch (error) {
    console.error("Error updating ratings and Points:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while updating ratings.", error });
  }
};

const updateUserPoints = async (req, res) => {
  try {
    const { confirmedRideId } = req.params; // Get confirmedRideId from req.params
    const { ratings } = req.body; // Get ratings from req.body

    if (!confirmedRideId || ratings === undefined) {
      return res
        .status(400)
        .json({ message: "confirmedRideId and ratings are required." });
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

    let userId;

    // Get userId from the ride document and update ratings
    await Promise.all(
      querySnapshot.docs.map(async (doc) => {
        userId = doc.data().userId; // Extract userId
        await doc.ref.update({ ratings });
      })
    );

    if (!userId) {
      return res.status(400).json({ message: "User ID not found in ride data." });
    }

    // Reference to the user's personal data collection
    const userRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const currentPoints = userDoc.data().Points || 0; // Default to 0 if not set
    const updatedPoints = currentPoints + ratings; // Add new ratings to Points

    // Update user's Points
    await userRef.update({ points: updatedPoints });

    return res.status(200).json({
      message: "Ratings and user Points updated successfully.",
      userId,
      updatedPoints,
    });
  } catch (error) {
    console.error("Error updating ratings and Points:", error);
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
         // userEmail:rideData.userEmail
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
    const { userId } = req.params; // Extract userId from URL params

    if (!userId) {
      return res.status(400).json({ error: "Missing userId in request parameters." });
    }

    if (typeof userId !== "string") {
      console.error("Invalid userId received:", userId);
      return res.status(400).json({ error: "Invalid userId. Expected a string." });
    }

    console.log(`Fetching ride details for userId: ${userId}`);

    const ridesCollection = admin.firestore().collection("rides");
    const querySnapshot = await ridesCollection
      .where("userId", "==", userId)
      .where("rideStatus", "==", "driver accepted")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "No ride found for this user." });
    }

    return res.status(200).json(querySnapshot.docs[0].data());
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({ error: "Failed to fetch ride details." });
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

    console.log("rides",rides)

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

const getAssignedDriverLocation = async (req, res) => {
  try {
    const { confirmedRideId } = req.params;

    if (!confirmedRideId) {
      return res.status(400).json({ error: "confirmedRideId is required." });
    }

    console.log(`Fetching driver location for confirmedRideId: ${confirmedRideId}`);

    const rideSnapshot = await admin.firestore()
      .collection("rides")
      .where("confirmedRideId", "==", confirmedRideId)
      .limit(1)
      .get();

    if (rideSnapshot.empty) {
      return res.status(404).json({ message: "Ride not found." });
    }

    const rideData = rideSnapshot.docs[0].data();
    console.log("Ride Data:", rideData);

    const rideStatus = rideData.rideStatus

    console.log("rideStatus",rideData.rideStatus)

    const driverId = rideData.driverId;
    if (!driverId) {
      return res.status(404).json({ message: "Driver ID not found in ride data." });
    }

    console.log(`Fetching all driver locations...`);

    const driverSnapshot = await admin.firestore().collection("drivers_location").get();

    if (driverSnapshot.empty) {
      return res.status(404).json({ message: "No drivers found in drivers_location collection." });
    }

    let allDrivers = [];

    driverSnapshot.forEach((doc) => {
      const driverData = doc.data();
      const driverId = driverData.driverId || doc.id;

      if (!driverData.current_location) {
        console.warn(`Warning: Driver ${driverId} has no current_location.`);
        return;
      }

      allDrivers.push({
        driverId: driverId,
        latitude: driverData.current_location?.latitude || 0,
        longitude: driverData.current_location?.longitude || 0,
        isActive: driverData.isActive ?? false,
      });
    });

    console.log("All Driver Locations:", allDrivers);

    const assignedDriverLocation = allDrivers.find((driver) => driver.driverId === driverId);

    if (!assignedDriverLocation) {
      console.log(`Driver with driverId: ${driverId} not found in drivers_location collection.`);
      return res.status(404).json({ message: "Driver location not found." });
    }

    console.log("Assigned Driver Location:", assignedDriverLocation);

    // Extract pickup location
    const { latitude: pickupLat, longitude: pickupLon } = rideData.pickupLocation;
    const { latitude: driverLat, longitude: driverLon } = assignedDriverLocation;

    // Calculate distance (km)
    const distance = haversineDistance(pickupLat, pickupLon, driverLat, driverLon);

    // Assume average speed (adjustable)
    const avgSpeed = 40; // km/h
    const estimatedTime = (distance / avgSpeed) * 60; // Time in minutes

    console.log(`Distance: ${distance.toFixed(2)} km, Estimated Time: ${estimatedTime.toFixed(2)} min`);
    rounedtime =  Math.round(estimatedTime) + " min"


    return res.status(200).json({
      message: "Driver location fetched successfully.",
      driverLocation: assignedDriverLocation,
      distance: distance.toFixed(2) + " km",
      estimatedTime: rounedtime,
      rideStatus:rideStatus
    });

  } catch (error) {
    console.error("Error fetching driver location:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const toRadians = (degree) => (degree * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};

const fetchAllPreRideRequests = async (req, res) => {
  try {
    const db = admin.firestore();
    const preRideRequestsSnapshot = await db.collection("preRideRequest").get();

    if (preRideRequestsSnapshot.empty) {
      return res.status(404).send({ message: "No preRideRequests found." });
    }

    const preRideRequests = preRideRequestsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).send({
      message: "PreRideRequests fetched successfully.",
      data: preRideRequests,
    });
  } catch (error) {
    console.error("Error fetching preRideRequests:", error.message);
    res.status(500).send({ error: error.message });
  }
};

 

const getAllRides = async (req, res) => {
  try {
    const ridesRef = admin.firestore().collection("rides");
    const snapshot = await ridesRef.get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No rides found." });
    }

    const rides = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const count = rides.length;

    return res.status(200).json({ rides,count  });
  } catch (error) {
    console.error("Error fetching all rides:", error);
    return res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

const getMostLatestRideByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    console.log(`Fetching latest ride for userId: ${userId}`);

    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given userId
    const querySnapshot = await ridesCollection.where("userId", "==", userId).get();

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "No rides found for the provided userId." });
    }

    let latestRide = null;

    querySnapshot.forEach((doc) => {
      const ride = doc.data();
      ride.id = doc.id;
      
      // Determine the latest ride based on timestamps
      const latestTimestamp = latestRide
        ? Math.max(
            latestRide.rideEndedTime?.toMillis() || 0,
            latestRide.rideStartedTime?.toMillis() || 0,
            latestRide.createdAt?.toMillis() || 0
          )
        : 0;

      const currentTimestamp = Math.max(
        ride.rideEndedTime?.toMillis() || 0,
        ride.rideStartedTime?.toMillis() || 0,
        ride.createdAt?.toMillis() || 0
      );

      if (!latestRide || currentTimestamp > latestTimestamp) {
        latestRide = ride;
      }
    });

    if (!latestRide) {
      return res.status(404).json({ message: "No valid rides found." });
    }

    return res.status(200).json({ message: "Latest ride fetched successfully.", latestRide });
  } catch (error) {
    console.error("Error fetching latest ride:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getMostLatestRideByDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({ error: "Driver ID is required." });
    }

 

    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given driverId
    const querySnapshot = await ridesCollection.where("driverId", "==", driverId).get();

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "No rides found for the provided driverId." });
    }

    let latestRide = null;

    querySnapshot.forEach((doc) => {
      const ride = doc.data();
      ride.id = doc.id;
      
      // Determine the latest ride based on timestamps
      const latestTimestamp = latestRide
        ? Math.max(
            latestRide.rideEndedTime?.toMillis() || 0,
            latestRide.rideStartedTime?.toMillis() || 0,
            latestRide.createdAt?.toMillis() || 0
          )
        : 0;

      const currentTimestamp = Math.max(
        ride.rideEndedTime?.toMillis() || 0,
        ride.rideStartedTime?.toMillis() || 0,
        ride.createdAt?.toMillis() || 0
      );

      if (!latestRide || currentTimestamp > latestTimestamp) {
        latestRide = ride;
      }
    });

    if (!latestRide) {
      return res.status(404).json({ message: "No valid rides found." });
    }

    return res.status(200).json({ message: "Latest ride fetched successfully.", latestRide });
  } catch (error) {
    console.error("Error fetching latest ride:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// const getAllRideRequests = async (req, res) => {
//   try {
//     // Reference to the 'ride_requests' in the Realtime Database
//     const rideRequestsRef = realtimeDb.ref('ride_requests');
    
//     // Fetch all ride requests from the database
//     const snapshot = await rideRequestsRef.once('value');
    
//     if (!snapshot.exists()) {
//       return res.status(404).send({ message: "No ride requests found." });
//     }
    
//     // Extract ride requests data
//     const rideRequests = [];
//     snapshot.forEach((childSnapshot) => {
//       rideRequests.push(childSnapshot.val()); // Push each ride request data into an array
//     });

//     return res.status(200).json({
//       message: "All ride requests fetched successfully.",
//       rideRequests: rideRequests
//     });

//   } catch (error) {
//     console.error("Error fetching all ride requests:", error.message);
//     return res.status(500).send({ error: error.message });
//   }
// };
const getAllRideRequests = async (req, res) => {
  try {
    // Reference to the 'ride_requests' in the Realtime Database
    const rideRequestsRef = realtimeDb.ref('ride_requests');
    
    // Fetch all ride requests from the database
    const snapshot = await rideRequestsRef.once('value');
    
    const rideRequests = [];

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        rideRequests.push(childSnapshot.val());
      });
    }

    return res.status(200).json({
      message: "All ride requests fetched successfully.",
      rideRequests: rideRequests, // Will be [] if no data
    });

  } catch (error) {
    console.error("Error fetching all ride requests:", error.message);
    return res.status(500).send({ error: error.message });
  }
};


const getStartedRidesByDriverLast = async (req, res) => {
  try {
    const { driverId } = req.params; // Extract driverId from the URL parameters

    if (!driverId) {
      return res.status(400).json({ error: "Driver ID is required." });
    }

    console.log(`Fetching started rides for driverId: ${driverId}`);

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that match the given driverId and have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("driverId", "==", driverId)
      .where("rideStatus", "==", "started")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found for the provided driverId.",
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

const getAllStartedRides = async (req, res) => {
  try {
    console.log("Fetching all started rides...");

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("rideStatus", "==", "started")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found.",
      });
    }

    // Map through the results and collect ride data
    const rides = [];
    querySnapshot.forEach(doc => {
      rides.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({
      message: "All started rides fetched successfully.",
      rides,
    });
  } catch (error) {
    console.error("Error fetching started rides:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getAllEndedRides = async (req, res) => {
  try {
    console.log("Fetching all started rides...");

    // Reference to the rides collection in Firestore
    const ridesCollection = admin.firestore().collection("rides");

    // Query for rides that have a rideStatus of "started"
    const querySnapshot = await ridesCollection
      .where("rideStatus", "==", "ended")
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        message: "No started rides found.",
      });
    }

    // Map through the results and collect ride data
    const rides = [];
    querySnapshot.forEach(doc => {
      rides.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({
      message: "All ended rides fetched successfully.",
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
  getAssignedDriverLocation ,
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
  getEndedRidesByUser,
  cancelRideRequest,
  fetchAllPreRideRequests,
  getAllRides,
  updateUserPoints,
  getMostLatestRideByUser,
  getMostLatestRideByDriver,
  getAllRideRequests,
  getStartedRidesByDriverLast,
  getAllStartedRides,
  getAllEndedRides
};
