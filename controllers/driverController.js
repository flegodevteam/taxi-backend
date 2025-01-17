const admin = require("firebase-admin");
const db = admin.firestore();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { firestore, realtimeDb } = require('../firebase/firebaseConfig');

const registerDriver = async (req, res) => {
    try {
        const {
            email,
            driverId,
            payment_Status = false,
            firstName,
            lastName,
            birthday,
            gender,
            telephone,
            address,
            isVehicleOwner,
            profileImg,
            nicFront,
            nicBack,
            licenseFront,
            licenseBack,
            whichVehicle,
            vehicleNumber,
            brand,
            model,
            vehicleFrontImg,
            vehicleInsideImg,
            vehicleOutsideImg,
            yourVehicleOnly,
            registered_date,
            Points,
            isPassanger,
            fcmToken,
            password,
            
        } = req.body;

        // Check for required fields
        if (!email || !fcmToken || !driverId || !password) {
            return res.status(400).send({ error: "Email, FCM token, driver ID, and password are required." });
        }

         // Check if email already exists
         const existingDriver = await firestore.collection("drivers_personal_data").doc(email).get();
         if (existingDriver.exists) {
             return res.status(400).send({ error: "A driver with this email already exists. Please use a different email." });
         }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Part 1: Save personal data (drivers_personal_data)
        const part1Data = {
            email,
            driverId,
            payment_Status,
            firstName,
            lastName,
            birthday,
            gender,
            telephone,
            address,
            isVehicleOwner,
            profileImg,
            nicFront,
            nicBack,
            licenseFront,
            licenseBack,
            registered_date,
            Points,
            isPassanger,
            fcmToken, // Including FCM token in part 1 data
            createdAt: new Date().toISOString(),
            password: hashedPassword,
            user_role:"driver",
            isAdminApprove:false
        };

        // Part 2: Save vehicle-specific details (drivers_vehicle_data)
        const part2Data = {
            whichVehicle,
            vehicleNumber,
            brand,
            model,
            vehicleFrontImg,
            vehicleInsideImg,
            vehicleOutsideImg,
            yourVehicleOnly
        };

        // Part 3: Save current location and isActive status (drivers_location)
        const part3Data = {
            current_location: null,
            isActive: false,
        };

        // Part 4: Save the FCM token in Realtime Database
        const fcmTokenPath = `drivers_tokens/${email.replace(/\./g, "_")}`;

        // Batch operation for Firestore
        const batch = firestore.batch();
        
        // Save to Firestore collections
        batch.set(firestore.collection("drivers_personal_data").doc(email), part1Data);
        batch.set(firestore.collection("drivers_vehicle_data").doc(email), part2Data);
        batch.set(firestore.collection("drivers_location").doc(email), part3Data);

        // Save the FCM token in the Realtime Database
        await realtimeDb.ref(fcmTokenPath).set(fcmToken);

        // Commit the batch operation
        await batch.commit();

        // Respond with success
        res.status(201).send({
            message: "Driver registered successfully",
            driverId,
            email
        });
    } catch (error) {
        // Handle errors and respond with a 500 status
        res.status(500).send({ error: error.message });
    }
};

//driver login with telephone
const driverLogin = async (req, res) => {
    try {
        const { telephone, password } = req.body;

        // Validate request body
        if (!telephone || !password) {
            return res.status(400).send({ error: "Telephone and password are required." });
        }

        // Fetch user data by telephone from Firestore
        const userSnapshot = await firestore
            .collection("drivers_personal_data")
            .where("telephone", "==", telephone)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            return res.status(401).send({ error: "Invalid telephone or password." });
        }

        // Extract user data
        const user = userSnapshot.docs[0].data();

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).send({ error: "Invalid telephone or password." });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.driverId,
                telephone: user.telephone,
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "1h" } // Token expires in 1 hour
        );

        // Respond with the token and user details
        res.status(200).send({
            message: "Login successful",
            token,
            user: {
                driverId: user.driverId,
                email: user.email,
                telephone: user.telephone,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred during login." });
    }
};

// Update driver location and isActive status
const updateDriverLocation = async (req, res) => {
    try {
        const { email, current_location, isActive } = req.body; // Include isActive from the request body
        const { latitude, longitude, city, province, country } = current_location;

        // Create the part3Data object with current_location and isActive
        const part3Data = {
            current_location: {
                latitude,
                longitude,
                city,
                province,
                country
            },
            isActive: isActive || false,  

        };

        // Use Firestore batch operation to update the location data
        const batch = db.batch();

        // Update the current location and isActive status in the drivers_location collection (Part 3)
        const part3Ref = db.collection("drivers_location").doc(email);
        batch.set(part3Ref, part3Data);

        // Commit the batch operation
        await batch.commit();

        // Send a response after the update
        res.send({ message: "Location and status updated successfully" });
    } catch (error) {
        // Send a response if an error occurs
        res.status(500).send({ error: error.message });
    }
};


//monitor driver location
const subscribeToDriverLocation = (email) => {
    const driverRef = db.collection("drivers_part2").doc(email);
    driverRef.onSnapshot((doc) => {
        if (doc.exists) {
            console.log("Current Location:", doc.data().current_location);
        }
    });
};


const getAllDrivers = async (req, res) => {
    try {
        // Fetch all drivers from the "drivers_personal_data" collection
        const driversSnapshot = await firestore.collection("drivers_personal_data").get();

        // Check if there are no drivers
        if (driversSnapshot.empty) {
            return res.status(404).send({ message: "No drivers found." });
        }

        // Prepare an array to hold all driver data
        const drivers = [];
        driversSnapshot.forEach(doc => {
            drivers.push({ id: doc.id, ...doc.data() });
        });

        // Return the drivers data
        res.status(200).send({ drivers });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

const getDriverByEmail = async (req, res) => {
    try {
        const { email } = req.params;

        // Fetch the driver by email from the "drivers_personal_data" collection
        const driverDoc = await firestore.collection("drivers_personal_data").doc(email).get();

        // Check if the driver exists
        if (!driverDoc.exists) {
            return res.status(404).send({ message: `Driver with email ${email} not found.` });
        }

        // Return the driver data
        res.status(200).send({ driver: { id: driverDoc.id, ...driverDoc.data() } });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

const deleteDriver = async (req, res) => {
    try {
        const { email } = req.params;

        // Check if the driver exists
        const driverDoc = await firestore.collection("drivers_personal_data").doc(email).get();
        if (!driverDoc.exists) {
            return res.status(404).send({ message: `Driver with email ${email} not found.` });
        }

        // Delete the driver data from Firestore collections
        await firestore.collection("drivers_personal_data").doc(email).delete();
        await firestore.collection("drivers_vehicle_data").doc(email).delete();
        await firestore.collection("drivers_location").doc(email).delete();

        // Delete the FCM token from the Realtime Database
        const fcmTokenPath = `drivers_tokens/${email.replace(/\./g, "_")}`;
        await realtimeDb.ref(fcmTokenPath).remove();

        res.status(200).send({ message: `Driver with email ${email} deleted successfully.` });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

const updatePaymentStatus = async (req, res) => {
    try {
        const { email } = req.params;
        const { payment_Status } = req.body;

        // Check for required fields
        if (!email || payment_Status === undefined) {
            return res.status(400).send({ error: "Email and payment status are required." });
        }

        // Check if the driver exists
        const driverDoc = await firestore.collection("drivers_personal_data").doc(email).get();
        if (!driverDoc.exists) {
            return res.status(404).send({ message: `Driver with email ${email} not found.` });
        }

        // Update the payment status
        await firestore.collection("drivers_personal_data").doc(email).update({
            payment_Status: payment_Status,
        });

        res.status(200).send({
            message: `Payment status updated successfully for driver with email ${email}.`,
            email,
            payment_Status,
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const loginByPhoneNumber = async (req, res) => {
    try {
        const { telephone } = req.body;

        // Validate request body
        if (!telephone) {
            return res.status(400).send({ error: "Telephone is required." });
        }

        // Fetch user data by telephone from Firestore
        const userSnapshot = await firestore
            .collection("drivers_personal_data")
            .where("telephone", "==", telephone)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            return res.status(404).send({ error: "No driver found with this telephone number." });
        }

        // Extract user data
        const user = userSnapshot.docs[0].data();

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.driverId,
                telephone: user.telephone,
                email: user.email,
            },
            JWT_SECRET, // Replace with your actual secret key
            { expiresIn: "1h" } // Token expires in 1 hour
        );

        // Respond with JWT token and all driver details
        res.status(200).send({
            message: "Driver details fetched successfully",
            token,
            driverDetails: {
                driverId: user.driverId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                telephone: user.telephone,
                address: user.address || null,
                licenseNumber: user.licenseNumber || null,
                vehicleDetails: user.vehicleDetails || null,
                // Add more fields as needed
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching driver details." });
    }
};

const updateIsAdminApprove = async (req, res) => {
    try {
        const { email } = req.params; // Extract email from route parameter
        const { isAdminApprove } = req.body; // Extract action from request body

        // Validate input
        if (isAdminApprove === undefined) {
            return res.status(400).send({ error: "isAdminApprove action is required." });
        }

        // Reference the driver's document in Firestore
        const driverRef = firestore.collection("drivers_personal_data").doc(email);

        // Check if the driver exists
        const driverDoc = await driverRef.get();
        if (!driverDoc.exists) {
            return res.status(404).send({ error: "Driver not found." });
        }

        // Update the isAdminApprove field
        await driverRef.update({ isAdminApprove });

        // Respond with success
        res.status(200).send({
            message: "Driver's admin approval status updated successfully.",
            email,
            isAdminApprove,
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};


const updateIsActive = async (req, res) => {
    try {
        const { email } = req.params; // Extract email from route parameter
        const { isActive } = req.body; // Extract action from request body

        // Validate input
        if (isActive === undefined) {
            return res.status(400).send({ error: "isActive action is required." });
        }

        // Reference the driver's document in Firestore
        const locationRef = firestore.collection("drivers_location").doc(email);

        // Check if the driver's location data exists
        const locationDoc = await locationRef.get();
        if (!locationDoc.exists) {
            return res.status(404).send({ error: "Driver's location data not found." });
        }

        // Update the isActive field
        await locationRef.update({ isActive });

        // Respond with success
        res.status(200).send({
            message: "Driver's active status updated successfully.",
            email,
            isActive,
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};


const driverLoginByEmail = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).send({ error: "Email and password are required." });
        }

        // Retrieve driver data from Firestore
        const driverDoc = await firestore.collection("drivers_personal_data").doc(email).get();

        // Check if the driver exists
        if (!driverDoc.exists) {
            return res.status(404).send({ error: "Driver not found. Please check your email or register first." });
        }

        const driverData = driverDoc.data();

        // Check if the password matches
        const isPasswordValid = await bcrypt.compare(password, driverData.password);
        if (!isPasswordValid) {
            return res.status(401).send({ error: "Invalid password. Please try again." });
        }

        // Check if the account is approved by admin
        if (!driverData.isAdminApprove) {
            return res.status(403).send({ error: "Your account is not yet approved by the admin." });
        }

        // Generate a JWT token for the driver
        const token = jwt.sign(
            {
                email: driverData.email,
                driverId: driverData.driverId,
                user_role: driverData.user_role
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" } // Token expires in 7 days
        );

        // Respond with success and token
        res.status(200).send({
            message: "Login successful.",
            token,
            driverId: driverData.driverId,
            email: driverData.email,
            user_role: driverData.user_role
        });
    } catch (error) {
        // Handle errors and respond with a 500 status
        res.status(500).send({ error: error.message });
    }
};


module.exports = {
    getAllDrivers,
    getDriverByEmail,
    deleteDriver,
    updatePaymentStatus,
    loginByPhoneNumber,
    registerDriver,
    updateDriverLocation,
    subscribeToDriverLocation,
    driverLogin,
    updateIsAdminApprove,
    updateIsActive,
    driverLoginByEmail
  };