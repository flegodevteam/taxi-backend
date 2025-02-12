const admin = require("firebase-admin");
const db = admin.firestore();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { firestore, realtimeDb } = require("../firebase/firebaseConfig");

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
    if (!email || !fcmToken || !driverId || !password || !telephone) {
      return res
        .status(400)
        .send({
          error: "Email, FCM token, driver ID, and password are required.",
        });
    }

    const bannedSnapshot = await firestore.collection("banned_drivers").get();
    bannedSnapshot.forEach((doc) => {
      console.log(doc.id, " => ", doc.data());
    });

    const bannedNumbers = bannedSnapshot.docs.map(
      (doc) => doc.data().personalData?.telephone
    );

    if (bannedNumbers.includes(telephone)) {
      return res
        .status(400)
        .send({
          error: "This telephone number is banned. Registration denied.",
        });
    }

    // Check if email already exists
    const existingDriver = await firestore
      .collection("drivers_personal_data")
      .doc(email)
      .get();
    if (existingDriver.exists) {
      return res
        .status(400)
        .send({
          error:
            "A driver with this email already exists. Please use a different email.",
        });
    }

    // Check if telephone already exists
    const existingDriverByTelephone = await firestore
      .collection("drivers_personal_data")
      .where("telephone", "==", telephone)
      .get();

    if (!existingDriverByTelephone.empty) {
      return res
        .status(400)
        .send({
          error:
            "A driver with this telephone number already exists. Please use a different telephone number.",
        });
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
      fcmToken,
      createdAt: new Date().toISOString(),
      password: hashedPassword,
      user_role: "driver",
      isAdminApprove: "under review",
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
      yourVehicleOnly,
    };

    // Part 3: Save current location and isActive status (drivers_location)
    const part3Data = {
      current_location: null,
      isActive: false,
    };

    // Part 4: Save the FCM token in Realtime Database
    const fcmTokenPath = `drivers_tokens/${driverId}`;

    // Batch operation for Firestore
    const batch = firestore.batch();

    // Save to Firestore collections
    batch.set(
      firestore.collection("drivers_personal_data").doc(driverId),
      part1Data
    );
    batch.set(
      firestore.collection("drivers_vehicle_data").doc(driverId),
      part2Data
    );
    batch.set(
      firestore.collection("drivers_location").doc(driverId),
      part3Data
    );

    // Save the FCM token in the Realtime Database
    await realtimeDb.ref(fcmTokenPath).set(fcmToken);

    // Commit the batch operation
    await batch.commit();

    // Respond with success
    res.status(201).send({
      message: "Driver registered successfully",
      driverId,
      email,
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
      return res
        .status(400)
        .send({ error: "Telephone and password are required." });
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
    const driverId = user.driverId;

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).send({ error: "Invalid telephone or password." });
    }

    // Fetch additional data (vehicle data and location data)
    const vehicleDataDoc = await firestore
      .collection("drivers_vehicle_data")
      .doc(driverId)
      .get();

    const locationDataDoc = await firestore
      .collection("drivers_location")
      .doc(driverId)
      .get();

    const vehicleData = vehicleDataDoc.exists ? vehicleDataDoc.data() : null;
    const locationData = locationDataDoc.exists ? locationDataDoc.data() : null;

    // Debug: Log fetched data
    console.log("Vehicle Data:", vehicleData);
    console.log("Location Data:", locationData);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.driverId,
        telephone: user.telephone,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // Respond with the token and user details
    res.status(200).send({
      message: "Login successful",
      token,
      driver: {
        email: user.email,
        driverId: user.driverId,
        payment_Status: user.payment_Status,
        firstName: user.firstName,
        lastName: user.lastName,
        birthday: user.birthday,
        gender: user.gender,
        telephone: user.telephone,
        address: user.address,
        isVehicleOwner: user.isVehicleOwner,
        profileImg: user.profileImg,
        nicFront: user.nicFront,
        nicBack: user.nicBack,
        licenseFront: user.licenseFront,
        licenseBack: user.licenseBack,
        registered_date: user.registered_date,
        Points: user.Points,
        isPassanger: user.isPassanger,
        createdAt: user.createdAt,
        user_role: user.user_role,
        isAdminApprove: user.isAdminApprove,
        vehicleData, // Include vehicle-specific details
        locationData, // Include location and activity status
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "An error occurred during login." });
  }
};

// Update driver location and isActive status
const updateDriverLocation = async (req, res) => {
  try {
    const { driverId, current_location, isActive } = req.body; // Include isActive from the request body
    const { latitude, longitude } = current_location;

    // Create the part3Data object with current_location and isActive
    const part3Data = {
      current_location: {
        latitude,
        longitude,
        // city,
        // province,
        // country
      },
      isActive: isActive || false,
    };

    // Use Firestore batch operation to update the location data
    const batch = db.batch();

    // Update the current location and isActive status in the drivers_location collection (Part 3)
    const part3Ref = db.collection("drivers_location").doc(driverId);
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
    const driversSnapshot = await firestore
      .collection("drivers_personal_data")
      .get();

    // Check if there are no drivers
    if (driversSnapshot.empty) {
      return res.status(404).send({ message: "No drivers found." });
    }

    // Prepare an array to hold all driver data
    const drivers = [];

    for (const doc of driversSnapshot.docs) {
      const driverId = doc.id;
      const driverData = doc.data();

      // Fetch additional vehicle data
      const vehicleDataDoc = await firestore
        .collection("drivers_vehicle_data")
        .doc(driverId)
        .get();

      // Fetch additional location data
      const locationDataDoc = await firestore
        .collection("drivers_location")
        .doc(driverId)
        .get();

      // Combine driver data with vehicle and location data
      drivers.push({
        id: driverId,
        ...driverData,
        vehicleData: vehicleDataDoc.exists ? vehicleDataDoc.data() : null,
        locationData: locationDataDoc.exists ? locationDataDoc.data() : null,
      });
    }

    // Return the combined data for all drivers
    res.status(200).send({ drivers });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const getDriverByEmail = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Fetch the driver by email from the "drivers_personal_data" collection
    const driverDoc = await firestore
      .collection("drivers_personal_data")
      .doc(driverId)
      .get();

    // Check if the driver exists
    if (!driverDoc.exists) {
      return res
        .status(404)
        .send({ message: `Driver with driver Id ${driverId} not found.` });
    }

    // Return the driver data
    res.status(200).send({ driver: { id: driverDoc.id, ...driverDoc.data() } });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const deleteDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Check if the driver exists
    const driverDoc = await firestore
      .collection("drivers_personal_data")
      .doc(driverId)
      .get();
    if (!driverDoc.exists) {
      return res
        .status(404)
        .send({ message: `Driver with ID ${driverId} not found.` });
    }

    // Fetch all driver-related data
    const driverPersonalData = driverDoc.data();
    const driverVehicleDataDoc = await firestore
      .collection("drivers_vehicle_data")
      .doc(driverId)
      .get();
    const driverLocationDoc = await firestore
      .collection("drivers_location")
      .doc(driverId)
      .get();

    const driverVehicleData = driverVehicleDataDoc.exists
      ? driverVehicleDataDoc.data()
      : {};
    const driverLocationData = driverLocationDoc.exists
      ? driverLocationDoc.data()
      : {};

    // Create a record in banned_drivers collection
    const bannedDriverData = {
      driverId,
      personalData: driverPersonalData,
      vehicleData: driverVehicleData,
      locationData: driverLocationData,
      bannedAt: new Date().toISOString(),
    };

    await firestore
      .collection("banned_drivers")
      .doc(driverId)
      .set(bannedDriverData);

    // Delete the driver data from Firestore collections
    await firestore.collection("drivers_personal_data").doc(driverId).delete();
    await firestore.collection("drivers_vehicle_data").doc(driverId).delete();
    await firestore.collection("drivers_location").doc(driverId).delete();

    // Delete the FCM token from the Realtime Database
    const fcmTokenPath = `drivers_tokens/${driverId}`;
    await realtimeDb.ref(fcmTokenPath).remove();

    res
      .status(200)
      .send({
        message: `Driver with ID ${driverId} has been banned and deleted successfully.`,
      });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { payment_Status } = req.body;

    // Check for required fields
    if (!driverId || payment_Status === undefined) {
      return res
        .status(400)
        .send({ error: "Email and payment status are required." });
    }

    // Check if the driver exists
    const driverDoc = await firestore
      .collection("drivers_personal_data")
      .doc(driverId)
      .get();
    if (!driverDoc.exists) {
      return res
        .status(404)
        .send({ message: `Driver with emdriverIdail ${driverId} not found.` });
    }

    // Update the payment status
    await firestore.collection("drivers_personal_data").doc(driverId).update({
      payment_Status: payment_Status,
    });

    res.status(200).send({
      message: `Payment status updated successfully for driver with email ${driverId}.`,
      driverId,
      payment_Status,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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
      return res
        .status(404)
        .send({ error: "No driver found with this telephone number." });
    }

    // Extract user data
    const user = userSnapshot.docs[0].data();
    const driverId = user.driverId;

    // Fetch additional data (vehicle data and location data)
    const vehicleDataDoc = await firestore
      .collection("drivers_vehicle_data")
      .doc(driverId)
      .get();

    const locationDataDoc = await firestore
      .collection("drivers_location")
      .doc(driverId)
      .get();

    const vehicleData = vehicleDataDoc.exists ? vehicleDataDoc.data() : null;
    const locationData = locationDataDoc.exists ? locationDataDoc.data() : null;

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
      driver: {
        email: user.email,
        driverId: user.driverId,
        payment_Status: user.payment_Status,
        firstName: user.firstName,
        lastName: user.lastName,
        birthday: user.birthday,
        gender: user.gender,
        telephone: user.telephone,
        address: user.address,
        isVehicleOwner: user.isVehicleOwner,
        profileImg: user.profileImg,
        nicFront: user.nicFront,
        nicBack: user.nicBack,
        licenseFront: user.licenseFront,
        licenseBack: user.licenseBack,
        registered_date: user.registered_date,
        Points: user.Points,
        isPassanger: user.isPassanger,
        createdAt: user.createdAt,
        user_role: user.user_role,
        isAdminApprove: user.isAdminApprove,
        vehicleData, // Include vehicle-specific details
        locationData, // Include location and activity status
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching driver details." });
  }
};

const updateIsAdminApprove = async (req, res) => {
  try {
    const { driverId } = req.params; // Extract driverId from route parameter
    const { isAdminApprove } = req.body; // Extract isAdminApprove from request body

    // Validate input
    if (isAdminApprove === undefined) {
      return res
        .status(400)
        .send({ error: "isAdminApprove action is required." });
    }

    // Define allowed values for isAdminApprove
    const allowedStatuses = ["approved", "block", "under review"];

    // Check if the provided isAdminApprove value is valid
    if (!allowedStatuses.includes(isAdminApprove)) {
      return res
        .status(400)
        .send({
          error:
            "Invalid isAdminApprove value. Allowed values are 'approved', 'block', or 'under review'.",
        });
    }

    // Reference the driver's document in Firestore
    const driverRef = firestore
      .collection("drivers_personal_data")
      .doc(driverId);

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
      driverId,
      isAdminApprove,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const updateIsActive = async (req, res) => {
  try {
    const { driverId } = req.params; // Extract email from route parameter
    const { isActive } = req.body; // Extract action from request body

    // Validate input
    if (isActive === undefined) {
      return res.status(400).send({ error: "isActive action is required." });
    }

    // Reference the driver's document in Firestore
    const locationRef = firestore.collection("drivers_location").doc(driverId);

    // Check if the driver's location data exists
    const locationDoc = await locationRef.get();
    if (!locationDoc.exists) {
      return res
        .status(404)
        .send({ error: "Driver's location data not found." });
    }

    // Update the isActive field
    await locationRef.update({ isActive });

    // Respond with success
    res.status(200).send({
      message: "Driver's active status updated successfully.",
      driverId,
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
      return res
        .status(400)
        .send({ error: "Email and password are required." });
    }

    // Retrieve driver data from Firestore
    const driverDoc = await firestore
      .collection("drivers_personal_data")
      .doc(email)
      .get();

    // Check if the driver exists
    if (!driverDoc.exists) {
      return res
        .status(404)
        .send({
          error: "Driver not found. Please check your email or register first.",
        });
    }

    const driverData = driverDoc.data();

    // Check if the password matches
    const isPasswordValid = await bcrypt.compare(password, driverData.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .send({ error: "Invalid password. Please try again." });
    }

    // Check if the account is approved by admin
    if (!driverData.isAdminApprove) {
      return res
        .status(403)
        .send({ error: "Your account is not yet approved by the admin." });
    }

    // Generate a JWT token for the driver
    const token = jwt.sign(
      {
        email: driverData.email,
        driverId: driverData.driverId,
        user_role: driverData.user_role,
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
      user_role: driverData.user_role,
    });
  } catch (error) {
    // Handle errors and respond with a 500 status
    res.status(500).send({ error: error.message });
  }
};

const getActiveDriversWithLocation = async (req, res) => {
  try {
    // Query Firestore to get only active drivers
    const activeDriversSnapshot = await firestore
      .collection("drivers_location")
      .where("isActive", "==", true)
      .get();

    if (activeDriversSnapshot.empty) {
      return res.status(404).send({ message: "No active drivers found." });
    }

    let activeDrivers = [];

    // Loop through the active drivers and fetch their details
    for (const doc of activeDriversSnapshot.docs) {
      const driverId = doc.id;
      const locationData = doc.data();

      // Fetch driver personal data
      const personalDataDoc = await firestore
        .collection("drivers_personal_data")
        .doc(driverId)
        .get();

      if (!personalDataDoc.exists) {
        continue; // Skip if personal data doesn't exist
      }

      const personalData = personalDataDoc.data();

      // Construct the driver object
      activeDrivers.push({
        driverId,
        firstName: personalData.firstName,
        lastName: personalData.lastName,
        email: personalData.email,
        telephone: personalData.telephone,
        vehicleNumber: personalData.vehicleNumber || "N/A",
        currentLocation: locationData.current_location || "Unknown",
        isActive: locationData.isActive,
      });
    }

    // Send response with active drivers
    res.status(200).send({ activeDrivers });
  } catch (error) {
    console.error("Error fetching active drivers:", error);
    res.status(500).send({ error: error.message });
  }
};

const getAllBannedDrivers = async (req, res) => {
  try {
    // Retrieve all documents from the banned_drivers collection
    const bannedDriversSnapshot = await firestore
      .collection("banned_drivers")
      .get();

    // Check if there are any banned drivers
    if (bannedDriversSnapshot.empty) {
      return res.status(404).send({ message: "No banned drivers found." });
    }

    // Map through the documents and extract the data
    const bannedDrivers = bannedDriversSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Send the list of banned drivers in the response
    res.status(200).send({
      message: "Banned drivers retrieved successfully.",
      data: bannedDrivers,
    });
  } catch (error) {
    // Send a response if an error occurs
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
  driverLoginByEmail,
  getActiveDriversWithLocation,
  getAllBannedDrivers,
};
