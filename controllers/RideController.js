const geolib = require('geolib'); 
const admin = require('firebase-admin'); 
const { firestore, realtimeDb } = require('../firebase/firebaseConfig');

//Controller for send the ride requests using Push notitications
const sendRideRequest = async (driverEmail, rideDetails) => {
    try {
        const sanitizedEmail = driverEmail.replace(/\./g, "_");

        // Check if vehicle_type is valid
        if (!rideDetails.whichVehicle) {
            throw new Error(`Vehicle type is undefined for driver ${driverEmail}`);
        }

        // Push the ride request details into Realtime Database
        const rideRequestsRef = realtimeDb.ref(`ride_requests/${sanitizedEmail}`);
        await rideRequestsRef.push({
            rideId: rideDetails.rideId,
            currentLocation: rideDetails.currentLocation,
            destinationLocation: rideDetails.destinationLocation,
            status: "pending",
            createdAt: admin.database.ServerValue.TIMESTAMP,
            driverEmail: driverEmail,
            userEmail: rideDetails.userEmail,
            vehicle_type: rideDetails.whichVehicle, // Ensure this is not undefined
        });

        // Get the FCM token for the driver
        const driverTokenRef = realtimeDb.ref(`drivers_tokens/${sanitizedEmail}`);
        const driverTokenSnapshot = await driverTokenRef.once("value");

        if (!driverTokenSnapshot.exists()) {
            throw new Error(`No FCM token found for driver ${driverEmail}`);
        }

        const driverToken = driverTokenSnapshot.val();
        const messaging = admin.messaging();

        // Log to check if messaging is correctly initialized
        console.log('Firebase Messaging:', messaging);

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
        await messaging.send({
            token: driverToken,
            notification: payload.notification,
            data: payload.data,
        })
            .then(response => {
                console.log('Successfully sent message:', response);
            })
            .catch(error => {
                console.error('Error sending message:', error);
            });

        console.log(`Push notification sent to driver: ${sanitizedEmail}`);
        return { message: "Ride request sent successfully." };
    } catch (error) {
        console.error("Error sending ride request:", error.message);
        throw new Error("Error sending ride request: " + error.message);
    }
};






// Controller for handling ride requests
// const requestRide = async (req, res) => {
//     try {
//         const { latitude, longitude, whichVehicle, destination } = req.body;

//         if (!latitude || !longitude || !destination) {
//             return res.status(400).send({ error: "Latitude, longitude, and destination are required." });
//         }

//         const currentLocation = { latitude, longitude };
//         const destinationLocation = destination;
//         const rideId = `RIDE${Date.now()}`;

//         const db = admin.firestore();

//         // Fetch active drivers
//         const driversSnapshot = await db.collection('drivers_location')
//             .where('isActive', '==', true)
//             .get();

//         if (driversSnapshot.empty) {
//             console.log('No active drivers found.');
//             return res.status(404).send({ message: "No available drivers found." });
//         }

//         // Retrieve driver details
//         const driversWithDetails = await Promise.all(driversSnapshot.docs.map(async (doc) => {
//             const driverEmail = doc.id;

//             // Fetch vehicle details
//             const vehicleSnapshot = await db.collection('drivers_vehicle_data').doc(driverEmail).get();
//             const vehicleData = vehicleSnapshot.exists ? vehicleSnapshot.data() : {};

//             return {
//                 email: driverEmail,
//                 current_location: doc.data().current_location,
//                 whichVehicle: vehicleData.whichVehicle || null,
//             };
//         }));

//         // Filter drivers within 5km radius
//         const driversWithin5km = driversWithDetails.filter(driver => {
//             if (!driver.current_location) return false;
//             const driverLocation = {
//                 latitude: driver.current_location.latitude,
//                 longitude: driver.current_location.longitude,
//             };
//             return geolib.getDistance(currentLocation, driverLocation) <= 5000;
//         });

//         // Filter drivers based on the vehicle type if specified
//         const filteredDrivers = whichVehicle
//             ? driversWithin5km.filter(driver => driver.whichVehicle?.toLowerCase() === whichVehicle.toLowerCase())
//             : driversWithin5km;

//         if (filteredDrivers.length === 0) {
//             console.log('No drivers match the criteria.');
//             return res.status(404).send({ message: "No drivers found within range or matching vehicle type." });
//         }

//         // Sort drivers by distance and take the nearest 5
//         const sortedDrivers = filteredDrivers.sort((a, b) =>
//             geolib.getDistance(currentLocation, a.current_location) -
//             geolib.getDistance(currentLocation, b.current_location)
//         ).slice(0, 5);

//         const sentRequests = [];
//         const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//         let lastSentTime = Date.now();

//         // Send the first request immediately
//         const firstDriver = sortedDrivers[0];
//         const rideDetails = { rideId, currentLocation, destinationLocation };

//         try {
//             await sendRideRequest(firstDriver.email, rideDetails);
//             sentRequests.push({
//                 driverEmail: firstDriver.email,
//                 status: "Request sent",
//             });
//         } catch (error) {
//             console.error(`Error sending request to driver ${firstDriver.email}:`, error.message);
//         }

//         // Send ride requests to the remaining drivers with a delay
//         for (let i = 1; i < sortedDrivers.length; i++) {
//             const driver = sortedDrivers[i];

//             const currentTime = Date.now();
//             const timeElapsed = currentTime - lastSentTime;
//             if (timeElapsed < 3000) {
//                 await delay(3000 - timeElapsed);
//             }

//             try {
//                 await sendRideRequest(driver.email, rideDetails);
//                 sentRequests.push({
//                     driverEmail: driver.email,
//                     status: "Request sent",
//                 });

//                 lastSentTime = Date.now();
//             } catch (error) {
//                 console.error(`Error sending request to driver ${driver.email}:`, error.message);
//             }
//         }

//         res.send({
//             message: "Ride request sent to nearest drivers.",
//             sentRequests,
//             destination: destinationLocation,
//         });
//     } catch (error) {
//         console.error('Error in requestRide:', error.message);
//         res.status(500).send({ error: error.message });
//     }
// };

// Correct one for ride requests
// const requestRide = async (req, res) => {
//     try {
//         const { latitude, longitude, whichVehicle, destination, userEmail } = req.body;

//         if (!latitude || !longitude || !destination || !userEmail) {
//             return res.status(400).send({ error: "Latitude, longitude, destination, and userEmail are required." });
//         }

//         const currentLocation = { latitude, longitude };
//         const destinationLocation = destination;
//         const rideId = `RIDE${Date.now()}`;

//         const db = admin.firestore();

//         // Fetch active drivers
//         const driversSnapshot = await db.collection('drivers_location')
//             .where('isActive', '==', true)
//             .get();

//         if (driversSnapshot.empty) {
//             console.log('No active drivers found.');
//             return res.status(404).send({ message: "No available drivers found." });
//         }

//         // Retrieve driver details
//         const driversWithDetails = await Promise.all(driversSnapshot.docs.map(async (doc) => {
//             const driverEmail = doc.id;

//             // Fetch vehicle details
//             const vehicleSnapshot = await db.collection('drivers_vehicle_data').doc(driverEmail).get();
//             const vehicleData = vehicleSnapshot.exists ? vehicleSnapshot.data() : {};

//             return {
//                 email: driverEmail,
//                 current_location: doc.data().current_location,
//                 whichVehicle: vehicleData.whichVehicle || null,
//             };
//         }));

//         // Filter drivers within 5km radius
//         const driversWithin5km = driversWithDetails.filter(driver => {
//             if (!driver.current_location) return false;
//             const driverLocation = {
//                 latitude: driver.current_location.latitude,
//                 longitude: driver.current_location.longitude,
//             };
//             return geolib.getDistance(currentLocation, driverLocation) <= 5000;
//         });

//         // Filter drivers based on the vehicle type if specified
//         const filteredDrivers = whichVehicle
//             ? driversWithin5km.filter(driver => driver.whichVehicle?.toLowerCase() === whichVehicle.toLowerCase())
//             : driversWithin5km;

//         if (filteredDrivers.length === 0) {
//             console.log('No drivers match the criteria.');
//             return res.status(404).send({ message: "No drivers found within range or matching vehicle type." });
//         }

//         // Sort drivers by distance and take the nearest 5
//         const sortedDrivers = filteredDrivers.sort((a, b) =>
//             geolib.getDistance(currentLocation, a.current_location) - 
//             geolib.getDistance(currentLocation, b.current_location)
//         ).slice(0, 5);

//         const sentRequests = [];
//         const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//         let lastSentTime = Date.now();

//         // Send the first request immediately
//         const firstDriver = sortedDrivers[0];
//         const rideDetails = { rideId, userEmail, currentLocation, destinationLocation ,whichVehicle};

//         console.log("userEmail in rideDetails:", rideDetails.userEmail);

//         try {
//             await sendRideRequest(firstDriver.email, rideDetails);
//             sentRequests.push({
//                 driverEmail: firstDriver.email,
//                 status: "Request sent",
//             });

//             // Save the ride request to Firestore with userEmail
//             const requestPayload = {
//                 rideId,
//                 userEmail, // Make sure this value is passed correctly
//                 driverEmail: firstDriver.email,
//                 status: "Request sent",
//                 currentLocation,
//                 destinationLocation,
//                 whichVehicle,
//                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
//             };

//             console.log("Firestore payload:", requestPayload);

//             await db.collection('ride_requests').add(requestPayload);
//         } catch (error) {
//             console.error(`Error sending request to driver ${firstDriver.email}:`, error.message);
//         }

//         // Send ride requests to the remaining drivers with a delay
//         for (let i = 1; i < sortedDrivers.length; i++) {
//             const driver = sortedDrivers[i];

//             const currentTime = Date.now();
//             const timeElapsed = currentTime - lastSentTime;
//             if (timeElapsed < 3000) {
//                 await delay(3000 - timeElapsed);
//             }

//             try {
//                 await sendRideRequest(driver.email, rideDetails);
//                 sentRequests.push({
//                     driverEmail: driver.email,
//                     status: "Request sent",
//                 });

//                 lastSentTime = Date.now();
//             } catch (error) {
//                 console.error(`Error sending request to driver ${driver.email}:`, error.message);
//             }
//         }

//         res.send({
//             message: "Ride request sent to nearest drivers.",
//             sentRequests,
//             destination: destinationLocation,
//         });
//     } catch (error) {
//         console.error('Error in requestRide:', error.message);
//         res.status(500).send({ error: error.message });
//     }
// };


const requestRide = async (req, res) => {
    try {
        const { latitude, longitude, whichVehicle, destination, userEmail } = req.body;

        if (!latitude || !longitude || !destination || !userEmail) {
            console.log('Error: Missing required fields');
            return res.status(400).send({ error: "Latitude, longitude, destination, and userEmail are required." });
        }

        const currentLocation = { latitude, longitude };
        const destinationLocation = destination;
        const rideId = `RIDE${Date.now()}`;

        const db = admin.firestore();
        console.log('Step 1: Fetching approved drivers with isAdminApprove = true');

        // Step 1: Fetch approved drivers with 'isAdminApprove' = true
        const approvedDriversSnapshot = await db.collection('drivers_personal_data')
            .where('isAdminApprove', '==', true)
            .get();

        if (approvedDriversSnapshot.empty) {
            console.log('No approved drivers found.');
            return res.status(404).send({ message: "No approved drivers available." });
        }

        console.log('Approved drivers found:', approvedDriversSnapshot.docs.length);
        // Extract emails of approved drivers
        const approvedDriverEmails = approvedDriversSnapshot.docs.map(doc => doc.id);

        console.log('Step 2: Fetching active drivers with isActive = true');
        
        // Step 2: Fetch active drivers with 'isActive' = true and match with approved driver emails
        const activeDriversSnapshot = await db.collection('drivers_location')
            .where('isActive', '==', true)
            .get();

        if (activeDriversSnapshot.empty) {
            console.log('No active drivers found.');
            return res.status(404).send({ message: "No active drivers available." });
        }

        console.log('Active drivers found:', activeDriversSnapshot.docs.length);
        const activeApprovedDrivers = activeDriversSnapshot.docs.filter(doc =>
            approvedDriverEmails.includes(doc.id)
        );

        if (activeApprovedDrivers.length === 0) {
            console.log('No drivers match the active and approved criteria.');
            return res.status(404).send({ message: "No active drivers match the approved criteria." });
        }

        console.log('Active and approved drivers found:', activeApprovedDrivers.length);

        console.log('Step 3: Checking payment status of the active and approved drivers');
        
        // Step 3: Check 'payment_Status' of the active and approved drivers
        const finalDrivers = await Promise.all(
            activeApprovedDrivers.map(async (doc) => {
                const driverEmail = doc.id;
                const driverPersonalData = await db.collection('drivers_personal_data').doc(driverEmail).get();

                if (driverPersonalData.exists && driverPersonalData.data().payment_Status === true) {
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
        const eligibleDrivers = finalDrivers.filter(driver => driver !== null);

        console.log('Eligible drivers:', eligibleDrivers.length);

        if (eligibleDrivers.length === 0) {
            console.log('No drivers match the payment status criteria.');
            return res.status(404).send({ message: "No drivers match the payment status criteria." });
        }

        console.log('Step 4: Filtering drivers within 5km radius');
        
        // Step 4: Filter drivers within 5km radius
        const driversWithin5km = eligibleDrivers.filter(driver => {
            if (!driver.current_location) return false;
            const driverLocation = {
                latitude: driver.current_location.latitude,
                longitude: driver.current_location.longitude,
            };
            return geolib.getDistance(currentLocation, driverLocation) <= 5000;
        });

        console.log('Drivers within 5km:', driversWithin5km);

        console.log('Step 5: Filtering drivers based on vehicle type');




        
       // Step 5: Filtering drivers based on the specified vehicle type if available
console.log("Step 5: Filtering drivers based on vehicle type.");
console.log("Requested vehicle type:", whichVehicle);

// Function to get vehicle type from the 'drivers_vehicle_data' collection
const getVehicleTypeFromVehicleData = async (driverEmail) => {
    try {
        const vehicleDataDoc = await db.collection('drivers_vehicle_data').doc(driverEmail).get();
        if (!vehicleDataDoc.exists) {
            console.log(`No vehicle data found for driver ${driverEmail}`);
            return null; // No vehicle data found
        }
        const vehicleData = vehicleDataDoc.data();
        console.log(`Fetched vehicle data for driver ${driverEmail}:`, vehicleData);
        return vehicleData.whichVehicle || null; // Accessing 'whichVehicle' directly
    } catch (error) {
        console.error("Error fetching vehicle data for driver:", driverEmail, error.message);
        return null;
    }
};

// Filter drivers based on the vehicle type
const filteredDrivers = [];

for (const driver of driversWithin5km) {
    console.log("Checking driver:", driver.email, "Vehicle:", driver.whichVehicle);

    let driverVehicleType = driver.whichVehicle;

    // If vehicle type is null, fetch it from 'drivers_vehicle_data'
    if (!driverVehicleType) {
        driverVehicleType = await getVehicleTypeFromVehicleData(driver.email);
        console.log("Fetched vehicle type for driver", driver.email, ":", driverVehicleType);
    }

    // Now filter based on the vehicle type (if whichVehicle was provided)
    if (whichVehicle && driverVehicleType && driverVehicleType.toLowerCase() === whichVehicle.toLowerCase()) {
        filteredDrivers.push(driver);
    }
    else if (!whichVehicle) {
        filteredDrivers.push(driver); // If no specific vehicle type is required, add all drivers
    }
}

console.log("Filtered drivers:", filteredDrivers);

if (filteredDrivers.length === 0) {
    console.log('No drivers match the final criteria.');
    return res.status(404).send({ message: "No drivers found within range or matching vehicle type." });
}





        console.log('Filtered drivers based on vehicle type:', filteredDrivers.length);

        console.log('Step 6: Sorting drivers by proximity');
        
        // Step 6: Sort drivers by proximity and send ride requests
        const sortedDrivers = filteredDrivers.sort((a, b) =>
            geolib.getDistance(currentLocation, a.current_location) - 
            geolib.getDistance(currentLocation, b.current_location)
        ).slice(0, 5);

        console.log('Sorted drivers (top 5):', sortedDrivers.length);

        const sentRequests = [];
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let lastSentTime = Date.now();

        // Send the first request immediately
        const firstDriver = sortedDrivers[0];
        const rideDetails = { rideId, userEmail, currentLocation, destinationLocation, whichVehicle };

        try {
            console.log(`Sending request to first driver: ${firstDriver.email}`);
            await sendRideRequest(firstDriver.email, rideDetails);
            sentRequests.push({
                driverEmail: firstDriver.email,
                status: "Request sent",
            });

            // Save the ride request to Firestore with userEmail
            const requestPayload = {
                rideId,
                userEmail,
                driverEmail: firstDriver.email,
                status: "Request sent",
                currentLocation,
                destinationLocation,
                whichVehicle,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            await db.collection('ride_requests').add(requestPayload);
        } catch (error) {
            console.error(`Error sending request to driver ${firstDriver.email}:`, error.message);
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
                console.error(`Error sending request to driver ${driver.email}:`, error.message);
            }
        }

        res.send({
            message: "Ride request sent to nearest drivers.",
            sentRequests,
            destination: destinationLocation,
        });
    } catch (error) {
        console.error('Error in sendRideRequestToFilteredDrivers:', error.message);
        res.status(500).send({ error: error.message });
    }
};





// Initialize Firestore
const db = admin.database(); 

// Controller to get ride requests for a driver
// const getRideRequestsForDriver = async (req, res) => {
//     const { driverEmail } = req.params;

//     // Step 1: Log the received and sanitized email
//     const sanitizedDriverEmail = driverEmail.trim().toLowerCase();
//     console.log('Received driverEmail (sanitized):', sanitizedDriverEmail);

//     try {
//         // Step 2: Reference to 'ride_requests' in Realtime Database and fetch all data
//         const rideRequestsRef = db.ref('ride_requests');
//         console.log('Firebase query reference (fetching all ride requests):', rideRequestsRef.toString()); 

//         const snapshot = await rideRequestsRef.once('value');

//         // Step 3: Log the snapshot data to check if any data is returned
//         if (!snapshot.exists()) {
//             console.log('No ride requests found.');
//             return res.status(200).json({ message: 'No ride requests found.', rideRequests: [] });
//         }

//         console.log('Snapshot exists. Retrieved all ride request data:', snapshot.val()); 
//         const allRideRequests = snapshot.val();
//         const filteredRideRequests = [];

//         // Step 4: Filter ride requests by driverEmail
//         Object.keys(allRideRequests).forEach(driver => {
//             // Check if the current driver matches the requested driverEmail
//             if (driver === sanitizedDriverEmail) {
//                 console.log(`Filtering ride requests for driver: ${driver}`);

//                 // Iterate through the ride requests for the current driver
//                 Object.keys(allRideRequests[driver]).forEach(rideId => {
//                     const rideData = allRideRequests[driver][rideId];

//                     // Step 5: Check if status is "pending"
//                     if (rideData.status === 'pending') {
//                         console.log('Adding pending ride request:', rideData);

//                         filteredRideRequests.push({
//                             rideId: rideData.rideId,
//                             driverEmail: rideData.driverEmail,
//                             vehicle_type: rideData.vehicle_type,
//                             status: rideData.status,
//                             currentLocation: rideData.currentLocation,
//                             destinationLocation: rideData.destinationLocation,
//                             requestedAt: rideData.createdAt ? new Date(rideData.createdAt).toISOString() : null,
//                         });
//                     }
//                 });
//             }
//         });

//         // Step 6: Send response with filtered ride requests
//         return res.status(200).json({ message: 'Ride requests fetched successfully.', rideRequests: filteredRideRequests });

//     } catch (error) {
//         console.error('Error fetching ride requests:', error);
//         return res.status(500).json({ error: 'Internal server error.' });
//     }
// };

// const handleRideRequest = async (req, res) => {
//     const { driverEmail } = req.params;
//     const { action, rideId } = req.body;

//     // Validate request parameters
//     if (!driverEmail || !action || !rideId) {
//         return res.status(400).json({
//             error: "Missing required parameters: driverEmail, action, or rideId."
//         });
//     }

//     if (action !== 'accept' && action !== 'reject') {
//         return res.status(400).json({
//             error: "Invalid action. Use 'accept' or 'reject'."
//         });
//     }

//     const driverEmailInDbFormat = driverEmail.replace(/\./g, '_');
//     try {
//         const rideRequestRef = admin.database().ref('ride_requests');

//         // Fetch all ride requests
//         const allRideRequestsSnapshot = await rideRequestRef.once('value');
//         if (!allRideRequestsSnapshot.exists()) {
//             return res.status(404).json({ message: "No ride requests found." });
//         }

//         // Collect all matching ride requests with the same rideId
//         const deletePromises = [];
//         let correctRideRequest = null;

//         allRideRequestsSnapshot.forEach(driverSnapshot => {
//             driverSnapshot.forEach(requestSnapshot => {
//                 const rideRequest = requestSnapshot.val();
//                 if (rideRequest.rideId === rideId) {
//                     // Save the correct ride request
//                     if (rideRequest.driverEmail === driverEmail && !correctRideRequest) {
//                         correctRideRequest = { ...rideRequest, id: requestSnapshot.key };
//                     }
//                     // Queue for deletion
//                     deletePromises.push(requestSnapshot.ref.remove());
//                 }
//             });
//         });

//         // Ensure a matching ride request exists for the given driver and rideId
//         if (!correctRideRequest) {
//             return res.status(404).json({
//                 message: `No ride request found with rideId: ${rideId} for driver: ${driverEmail}.`
//             });
//         }

//         if (action === 'accept') {
//             // Accept the ride request
//             await Promise.all(deletePromises); 

//             // Prepare the data for the new ride document
//             const rideDataToSave = {
//                 confirmedRideId: rideId,
//                 driverEmail: correctRideRequest.driverEmail,
//                 pickupLocation: correctRideRequest.currentLocation,
//                 dropLocation: null,
//                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
//                 rideStatus: "started",
//                 waiting_time_started:null,
//                 waiting_time_ended :null,
//                 waiting_time:null
//             };

//             // Create a new 'rides' document in Firestore
//             await admin.firestore().collection('rides').add(rideDataToSave);

//             return res.status(200).json({
//                 message: "Ride request accepted and new ride created successfully.",
//                 rideId
//             });
//         } else if (action === 'reject') {
//             // Reject the ride request
//             await Promise.all(deletePromises); 

//             return res.status(200).json({
//                 message: "Ride request rejected successfully.",
//                 rideId
//             });
//         }
//     } catch (error) {
//         console.error("Error handling ride request:", error.message, error.stack);
//         return res.status(500).json({
//             error: "Internal server error. Please try again later."
//         });
//     }
// };

const handleRideRequest = async (req, res) => {
    const { driverEmail } = req.params;
    const { action, rideId } = req.body;

    // Step 1: Validate request parameters
    console.log(`Received request: driverEmail=${driverEmail}, action=${action}, rideId=${rideId}`);

    if (!driverEmail || !action || !rideId ) {
        return res.status(400).json({
            error: "Missing required parameters: driverEmail, action or rideId."
        });
    }

    if (action !== 'accept' && action !== 'reject') {
        return res.status(400).json({
            error: "Invalid action. Use 'accept' or 'reject'."
        });
    }

    // Step 2: Transform the driver email for Firebase compatibility
    const driverEmailInDbFormat = driverEmail.replace(/\./g, '_');
    console.log(`Transformed driverEmail for Firebase: ${driverEmailInDbFormat}`);

    try {
        const rideRequestRef = admin.database().ref('ride_requests');

        // Step 3: Fetch ride requests for the given driver
        const driverRequestsSnapshot = await rideRequestRef.child(driverEmailInDbFormat).once('value');
        if (!driverRequestsSnapshot.exists()) {
            console.log(`No ride requests found for driver: ${driverEmailInDbFormat}`);
            return res.status(404).json({ message: "No ride requests found for the specified driver." });
        }

        // Step 4: Find the matching ride request
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
        console.log("correctRideRequest",correctRideRequest)
        // Step 5: Handle case where no matching ride request is found
        if (!correctRideRequest) {
            console.log(`No matching ride request found with rideId: ${rideId} for driver: ${driverEmailInDbFormat}`);
            return res.status(404).json({
                message: `No matching ride request found with rideId: ${rideId} for driver: ${driverEmail}.`
            });
        }

        // Step 6: Perform the action (accept or reject)
        if (action === 'accept') {
            console.log("Accepting the ride request...");
        
            // Step 1: Remove all requests for the driver
            await rideRequestRef.child(driverEmailInDbFormat).remove();
            console.log("Deleted all ride requests for the accepting driver.");
        
            // Step 2: Remove this rideId from all other drivers' ride requests
            const allRideRequestsSnapshot = await rideRequestRef.once('value');
            if (allRideRequestsSnapshot.exists()) {
                const allRideRequests = allRideRequestsSnapshot.val();
        
                for (const [otherDriverEmail, rides] of Object.entries(allRideRequests)) {
                    for (const [key, rideRequest] of Object.entries(rides)) {
                        if (rideRequest.rideId === rideId) {
                            await rideRequestRef.child(otherDriverEmail).child(key).remove();
                            console.log(
                                `Deleted ride request with rideId: ${rideId} for driver: ${otherDriverEmail}`
                            );
                        }
                    }
                }
            }
        
            // Step 3: Save the accepted ride as a new document in Firestore
            const rideDataToSave = {
                confirmedRideId: rideId,
                userEmail:correctRideRequest.userEmail,
                vehicle_type:correctRideRequest.vehicle_type,
                driverEmail: correctRideRequest.driverEmail,
                pickupLocation: correctRideRequest.currentLocation,
                // dropLocation: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                rideStatus: "driver accepted",
                rideStartedLocation:null,
                rideStartedTime:null,
                rideEndedLocation:null,
                rideEndedTime:null,
                far_of_ride:null,
                ride_time:null,
                waiting_time_started: null,
                waiting_time_ended: null,
                waiting_time: null,
                
            };
        
            await admin.firestore().collection('rides').add(rideDataToSave);
            console.log("New ride created successfully in Firestore.");
        
            return res.status(200).json({
                message: "Ride request accepted and new ride created successfully.",
                rideId,
            });
        }else if (action === 'reject') {
            console.log("Rejecting the ride request...");

            // Remove the specific ride request
            await rideRequestRef.child(driverEmailInDbFormat).child(correctRideKey).remove();
            console.log(`Ride request with rideId: ${rideId} rejected successfully.`);

            return res.status(200).json({
                message: "Ride request rejected successfully.",
                rideId
            });
        }
    } catch (error) {
        console.error("Error handling ride request:", error.message, error.stack);
        return res.status(500).json({
            error: "Internal server error. Please try again later."
        });
    }
};



const updateWaitingTime = async (req, res) => {
    const { confirmedRideId } = req.params;
    const { action } = req.body;

    // Validate input
    if (!confirmedRideId || !action) {
        return res.status(400).json({
            error: "Missing required parameters: confirmedRideId or action."
        });
    }

    if (action !== 'start' && action !== 'end') {
        return res.status(400).json({
            error: "Invalid action. Use 'start' or 'end'."
        });
    }

    try {
        const ridesRef = admin.firestore().collection('rides');

        // Fetch all documents in the 'rides' collection
        const allRidesSnapshot = await ridesRef.get();

        // Find the correct ride document that matches the confirmedRideId
        const rideDoc = allRidesSnapshot.docs.find(doc => doc.data().confirmedRideId === confirmedRideId);

        if (!rideDoc) {
            return res.status(404).json({
                error: "Ride not found."
            });
        }

        const rideData = rideDoc.data();

        // Check if the rideStatus is 'ended'
        if (rideData.rideStatus === 'ended') {
            return res.status(400).json({
                error: "Cannot update waiting time for an ended ride."
            });
        }

        if (action === 'start') {
            // Update waiting_time_started with current time
            await ridesRef.doc(rideDoc.id).update({
                waiting_time_started: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.status(200).json({
                message: "Waiting time started successfully."
            });
        } else if (action === 'end') {
            // Update waiting_time_ended with current time
            await ridesRef.doc(rideDoc.id).update({
                waiting_time_ended: admin.firestore.FieldValue.serverTimestamp()
            });

            // Fetch updated ride data
            const updatedRideDoc = await ridesRef.doc(rideDoc.id).get();
            const updatedRideData = updatedRideDoc.data();

            if (updatedRideData.waiting_time_started && updatedRideData.waiting_time_ended) {
                // Calculate waiting time in minutes
                const waitingTimeStarted = updatedRideData.waiting_time_started.toDate();
                const waitingTimeEnded = updatedRideData.waiting_time_ended.toDate();
                const waitingTimeMinutes = Math.ceil((waitingTimeEnded - waitingTimeStarted) / 60000); // Convert ms to minutes

                // Update the waiting_time field
                await ridesRef.doc(rideDoc.id).update({ waiting_time: waitingTimeMinutes });

                return res.status(200).json({
                    message: "Waiting time ended and calculated successfully.",
                    waiting_time: waitingTimeMinutes
                });
            } else {
                return res.status(400).json({
                    error: "Cannot calculate waiting time. Ensure both start and end times are set."
                });
            }
        }
    } catch (error) {
        console.error("Error updating waiting time:", error.message, error.stack);
        return res.status(500).json({
            error: "Internal server error. Please try again later."
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
        const ridesCollection = admin.firestore().collection('rides');
        const querySnapshot = await ridesCollection.where('confirmedRideId', '==', rideId).get();

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





// const handleRideRequest = async (req, res) => {
//     const { driverEmail } = req.params;
//     const { action, rideId } = req.body;

//     if (!driverEmail) {
//         return res.status(400).json({
//             error: "Driver email is required."
//         });
//     }

//     if (action !== 'accept' && action !== 'reject') {
//         return res.status(400).json({
//             error: "Invalid action. Use 'accept' or 'reject'."
//         });
//     }

//     try {
//         const rideRequestRef = admin.database().ref('ride_requests');
//         const allRideRequestsSnapshot = await rideRequestRef.once('value');

//         if (!allRideRequestsSnapshot.exists()) {
//             return res.status(404).json({
//                 message: "No ride requests found."
//             });
//         }

//         const allRideRequests = [];
//         allRideRequestsSnapshot.forEach(docSnapshot => {
//             const rideRequest = docSnapshot.val();
//             allRideRequests.push({ id: docSnapshot.key, ...rideRequest });
//         });

//         const modifiedDriverEmail = driverEmail.replace(/\./g, "_");
//         const matchingRideRequests = allRideRequests.filter(rideRequest => rideRequest.id === modifiedDriverEmail);

//         if (matchingRideRequests.length === 0) {
//             return res.status(404).json({
//                 message: `No ride requests found for driver ${driverEmail}.`
//             });
//         }

//         // Find the correct ride request object based on rideId
//         let correctRideRequest = null;

//         matchingRideRequests.forEach(rideRequest => {
//             Object.keys(rideRequest).forEach(key => {
//                 if (rideRequest[key]?.rideId === rideId) {
//                     correctRideRequest = rideRequest[key];
//                 }
//             });
//         });

//         if (!correctRideRequest) {
//             return res.status(404).json({
//                 message: `No ride request found with rideId: ${rideId}.`
//             });
//         }

//         console.log("Correct Ride Request:", correctRideRequest);

//         // Further processing of the correct ride request...
//         res.status(200).json({
//             message: "Ride request processed successfully.",
//             correctRideRequest,
//         });

//     } catch (error) {
//         console.error("Error handling ride request:", error.message, error.stack);
//         return res.status(500).json({
//             error: "Internal server error. Please try again later."
//         });
//     }
// };



//handle driver response 
// const handleRideRequest = async (req, res) => {
//     const {  driverEmail} = req.params;  // Ride ID to handle the request action on
//     const { action, rideId } = req.body;  // action will be either 'accept' or 'reject'

//     // Ensure driverEmail is provided
//     if (!driverEmail) {
//         return res.status(400).json({
//             error: "Driver email is required."
//         });
//     }

//     try {
//         // Reference to the Realtime Database for ride requests
//         const rideRequestRef = admin.database().ref('ride_requests');

//         // Fetch all ride requests under the specific driverEmail
//         const driverRideRequestsSnapshot = await rideRequestRef.orderByChild('driverEmail').equalTo(driverEmail).once('value');

//         // If no ride requests are found for the given driver email
//         if (!driverRideRequestsSnapshot.exists()) {
//             return res.status(404).json({
//                 message: "No ride requests found for this driver."
//             });
//         }

//         // Log all the fetched ride requests
//         const driverRideRequests = [];
//         driverRideRequestsSnapshot.forEach(docSnapshot => {
//             const rideRequest = docSnapshot.val();
//             driverRideRequests.push(rideRequest); // Collect all ride requests assigned to this driver
//         });

//         console.log("Fetched Ride Requests for Driver:", driverRideRequests);  // Log the fetched requests

//         // Now filter out the specific ride request by rideId
//         const rideData = driverRideRequests.find(rideRequest => rideRequest.rideId === rideId);

//         if (!rideData) {
//             return res.status(404).json({
//                 message: "Ride request not found for the specified rideId."
//             });
//         }

//         // Check if the status is already 'Accepted' or 'Rejected'
//         if (rideData.status !== 'pending') {
//             return res.status(400).json({
//                 message: "This ride request has already been processed."
//             });
//         }

//         // Handle the action (accept/reject)
//         if (action === 'accept') {
//             // Update status to 'Accepted' in the Realtime Database
//             await rideRequestRef.child(rideId).update({
//                 status: 'Accepted',
//                 acceptedAt: admin.database.ServerValue.TIMESTAMP // Track the acceptance time (optional)
//             });

//             // Delete all other ride requests with the same prefix (before the driver's email)
//             const deletePromises = [];
//             driverRideRequestsSnapshot.forEach(docSnapshot => {
//                 const rideRequest = docSnapshot.val();
//                 // Only delete the ones that are not already accepted or rejected
//                 if (rideRequest.status === 'pending' && docSnapshot.key !== rideId) {
//                     deletePromises.push(docSnapshot.ref.remove());
//                 }
//             });

//             // Wait for all deletions to complete
//             await Promise.all(deletePromises);

//             // Now create a new 'Ride' document in Firestore
//             const rideDataToSave = {
//                 confirmedRideId: rideId, // Use the previous rideId as confirmedRideId
//                 driverEmail: rideData.driverEmail, // Driver's email
//                 pickupLocation: rideData.currentLocation, // Current location of the driver
//                 dropLocation: null, // Drop location is initially null
//                 createdAt: admin.firestore.FieldValue.serverTimestamp(), // Timestamp of the ride creation
//                 rideStatus: "start"
//             };

//             // Add the new ride document to Firestore
//             await admin.firestore().collection('rides').add(rideDataToSave);

//             // Optionally, you can delete the document after accepting
//             await rideRequestRef.child(rideId).remove();  // Delete the ride request after accepting

//             return res.status(200).json({
//                 message: "Ride request accepted and new ride created successfully.",
//                 rideId
//             });
//         } else if (action === 'reject') {
//             // Update status to 'Rejected'
//             await rideRequestRef.child(rideId).update({
//                 status: 'Rejected',
//                 rejectedAt: admin.database.ServerValue.TIMESTAMP // Track rejection time (optional)
//             });

//             return res.status(200).json({
//                 message: "Ride request rejected successfully.",
//                 rideId
//             });
//         } else {
//             return res.status(400).json({
//                 message: "Invalid action. Use 'accept' or 'reject'."
//             });
//         }

//     } catch (error) {
//         console.error("Error handling ride request:", error.message, error.stack);
//         return res.status(500).json({
//             error: "Internal server error. Please try again later."
//         });
//     }
// };





// Driver responds to the ride request
const respondToRideRequest = async (req, res) => {
    try {
        const { requestId, response } = req.body; 

        if (!requestId || !response) {
            return res.status(400).send({ error: "Request ID and response are required." });
        }

        if (!["accepted", "declined"].includes(response)) {
            return res.status(400).send({ error: "Response must be either 'accepted' or 'declined'." });
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

// Get ride requests for a driver
// const getRideRequestsForDriver = async (req, res) => {

//     console.log("ggg")
//     try {
//         const { driverEmail } = req.params;

//         const driverId =driverEmail;

//         if (!driverId) {
//             return res.status(400).send({ error: "Driver ID is required." });
//         }

//         console.log("Received driverId:", driverId);  // Log the received driverId

//         const db = admin.database();

//         // Fetch ride requests by driverEmail only
//         const requestsSnapshot = await db.ref("ride_requests")
//             .orderByChild("driverEmail") // Ensure you're ordering by the correct field
//             .equalTo(driverId)           // Match on driverEmail
//             .get();

//         console.log("Snapshot fetched:", requestsSnapshot.val());  

//         // If no ride requests found for the driver
//         if (!requestsSnapshot.exists()) {
//             console.log("No ride requests found for the driver:", driverId);  // Debug log
//             return res.status(404).send({
//                 message: `No ride requests found for driver: ${driverId}.`
//             });
//         }

//         // If ride requests are found, we process them
//         const requests = requestsSnapshot.val();
//         console.log("Ride requests data:", requests);  // Log the ride requests

//         // Now, filter for only 'pending' status requests
//         const pendingRequests = Object.keys(requests)
//             .map(key => requests[key])  // Convert object into an array of requests
//             .filter(request => request.status === "pending");

//         console.log("Filtered pending requests:", pendingRequests);  // Log the filtered requests

//         // If no pending requests, send a custom message
//         if (pendingRequests.length === 0) {
//             console.log("No pending requests found for driver:", driverId);  // Debug log
//             return res.status(404).send({
//                 message: `No pending ride requests found for driver: ${driverId}.`
//             });
//         }

//         // Send the filtered pending requests as response
//         res.status(200).send({
//             message: "Ride requests fetched successfully.",
//             rideRequests: pendingRequests
//         });
        
//     } catch (error) {
//         console.error("Error fetching ride requests:", error.message);
//         res.status(500).send({ error: error.message });
//     }
// };
const getRideRequestsForDriver = async (req, res) => {
    try {
        // Get driverEmail from the params and replace '.' with '_'
        let { driverEmail } = req.params;
        driverEmail = driverEmail.replace(/\./g, '_'); // Replace all dots with underscores

        if (!driverEmail) {
            return res.status(400).send({ error: "Driver email is required." });
        }

        const db = admin.database();

        // Fetch all ride requests
        const requestsSnapshot = await db.ref("ride_requests").once("value");

        // Check if data exists in the snapshot
        if (!requestsSnapshot.exists()) {
            return res.status(404).send({
                message: "No ride requests found."
            });
        }

        // Log the structure of the fetched data for debugging
        console.log("Fetched ride requests:", requestsSnapshot.val());

        // To hold the filtered ride requests for the given driver
        const driverRideRequests = [];

        // Iterate over each driver in the ride_requests data
        requestsSnapshot.forEach(driverSnapshot => {
            const driverKey = driverSnapshot.key; // This is the driver email (e.g., 'testdriver12@example_com')

            // Check if the current driver's email matches the requested driverEmail (replacing dots)
            if (driverKey === driverEmail) {
                // Iterate through the ride requests for this driver
                driverSnapshot.forEach(rideRequestSnapshot => {
                    const rideRequest = rideRequestSnapshot.val(); // Get the details of each ride request

                    // Check if the ride request has the status 'pending'
                    if (rideRequest.status === "pending") {
                        // Add the ride request to the array
                        driverRideRequests.push(rideRequest);
                    }
                });
            }
        });

        // If no ride requests are found for the driver, send a response
        if (driverRideRequests.length === 0) {
            return res.status(404).send({
                message: `No pending ride requests found for driver: ${driverEmail.replace(/_/g, '.')}.`
            });
        }

        // Send the filtered ride requests as response
        res.status(200).send({
            message: "Ride requests fetched successfully.",
            rideRequests: driverRideRequests
        });

    } catch (error) {
        console.error("Error fetching ride requests:", error.message);
        res.status(500).send({ error: error.message });
    }
};




const updateRideStatus = async (req, res) => {
    const { rideId } = req.params; // Get rideId from URL parameter
    const { action, latitude, longitude } = req.body;   // Get action ('start' or 'end') and new location from the request body

    try {
        if (!rideId) {
            return res.status(400).json({
                message: "Missing rideId in the request.",
            });
        }

        console.log(`Fetching ride details for rideId: ${rideId}`);

        // Query Firestore for the ride with the given rideId (confirmedRideId)
        const ridesCollection = admin.firestore().collection('rides');
        const querySnapshot = await ridesCollection.where('confirmedRideId', '==', rideId).get();

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

        if (action === 'start') {
            await rideRef.update({
                rideStartedLocation: { latitude: 8.555, longitude: 80.37 }, // Example location
                rideStartedTime: admin.firestore.FieldValue.serverTimestamp(),
                rideStatus: 'started',
            });
            return res.status(200).send({ message: 'Ride started successfully.' });
        } 
        else if (action === 'end') {
            const rideEndedLocation = { latitude, longitude }; // Using the latitude and longitude from the request
            const rideEndedTime = admin.firestore.Timestamp.now(); // Get the actual current timestamp

            // Check if rideStartedTime exists and is an instance of Firestore Timestamp
            if (!(rideData.rideStartedTime instanceof admin.firestore.Timestamp)) {
                return res.status(400).send({ error: "Invalid ride start time." });
            }

            // Calculate distance and ride time (assuming you have helper functions for this)
            const distance = calculateDistance(rideData.rideStartedLocation, rideEndedLocation);
            const rideTime = calculateRideTime(rideData.rideStartedTime, rideEndedTime);

            await rideRef.update({
                rideEndedLocation,
                rideEndedTime,  // Use the actual timestamp here
                rideStatus: 'ended',
                far_of_ride: distance,
                ride_time: rideTime,
            });

            return res.status(200).send({ message: 'Ride ended successfully.' });
        } 
        else {
            return res.status(400).json({ error: "Invalid action. Must be 'start' or 'end'." });
        }
    } catch (error) {
        console.error("Error updating ride status:", error);
        return res.status(500).json({
            message: "Failed to update ride status.",
            error: error.message,
        });
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

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
};

// Helper function for calculating ride time
const calculateRideTime = (startTime, endTime) => {
    console.log("Start Time:", startTime);
    console.log("End Time:", endTime);

    if (!(startTime instanceof admin.firestore.Timestamp) || !(endTime instanceof admin.firestore.Timestamp)) {
        throw new Error("Invalid timestamps provided.");
    }

    const startMillis = startTime.toMillis(); // Convert to milliseconds
    const endMillis = endTime.toMillis(); // Convert to milliseconds

    const rideDurationMillis = endMillis - startMillis; // Duration in milliseconds

    // Convert milliseconds to minutes (1 minute = 60,000 milliseconds)
    const rideDurationMinutes = rideDurationMillis / 60000; 

    return rideDurationMinutes; // Ride time in minutes
};






module.exports = {
    requestRide,
    sendRideRequest,
    respondToRideRequest,
    handleRideRequest,
    getRideRequestsForDriver,
    updateWaitingTime,
    getRideDetails,
    updateRideStatus
};
