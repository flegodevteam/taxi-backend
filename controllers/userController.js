const admin = require("firebase-admin");
const db = admin.firestore();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { firestore, realtimeDb } = require('../firebase/firebaseConfig');

const createUser = async (req, res) => {
    try {
        const id = req.body.email;
        const userJson = {
            email: req.body.email,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
        };

        // Wait for the Firebase operation to complete
        await db.collection("users").doc(id).set(userJson);

        // Send a response only after the operation is complete
        res.send({ message: "User created successfully", data: userJson });
    } catch (error) {
        // Send a response if an error occurs
        res.status(500).send({ error: error.message });
    }
};

// Register function
// Register function
const registerUser = async (req, res) => {
    try {
        // Extract data from the request body
        const {
            userId,
            firstName,
            lastName,
            email,
            password,
            iDnum,
            birthday,
            province,
            district,
            phoneNumber,
            profileImg,
            registed_Date,
            points,
            fcmToken,
        } = req.body;

        // Check for required fields
        if (!email || !fcmToken || !password || !userId) {
            return res.status(400).send({ error: "Email, FCM token, and password are required." });
        }

        const bannedSnapshot = await firestore.collection("banned_Users").get();
        const bannedNumbers = bannedSnapshot.docs
            .map(doc => doc.get("phoneNumber")) // Ensure correct field retrieval
            .filter(phoneNumber => phoneNumber !== undefined); // Remove undefined values

        console.log("Banned Numbers:", bannedNumbers);

        if (bannedNumbers.includes(phoneNumber)) {
            return res.status(400).send({ error: "This phone Number  is banned. Registration denied." });
        }

        // Check if email already exists
        const existingUser = await db.collection("users").doc(userId).get();
        if (existingUser.exists) {
            return res.status(400).send({ error: "A user with this userId already exists. Please use a different email." });
        }

        // Check if phoneNumber already exists
        const existingUserByPhoneNumber = await db
            .collection("users")
            .where("phoneNumber", "==", phoneNumber)
            .get();
        if (!existingUserByPhoneNumber.empty) {
            return res.status(400).send({ error: "A user with this phone number already exists. Please use a different phone number." });
        }

        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

        // Combine all the fields into one record
        const userData = {
            userId,
            firstName,
            lastName,
            email,
            password: hashedPassword,
            iDnum,
            birthday,
            province,
            district,
            phoneNumber,
            profileImg,
            registed_Date,
            points,
            fcmToken,
            user_role:"user",
            //registeredTime: new Date().toISOString()
        };

        // Save data to the Firestore collection (e.g., "users")
        const userRef = db.collection("users").doc(userId);
        await userRef.set(userData);

        // Save the FCM token in the Realtime Database
        const fcmTokenPath = `users_tokens/${userId}`;
        await realtimeDb.ref(fcmTokenPath).set(fcmToken);

        // Send a response after the data is saved
        res.status(201).send({
            message: "User registered successfully",
            data: {
                userId,
                firstName,
                lastName,
                email,
                iDnum,
                birthday,
                province,
                district,
                phoneNumber,
                profileImg,
                registed_Date,
                points
            },
        });
    } catch (error) {
        // Send a response if an error occurs
        res.status(500).send({ error: error.message });
    }
};





// const registerDriver = async (req, res) => {
//     try {
//         // Extract data from the request body
//         const {
//             email,
//             // driver_name,
//             // driver_contact,
//             // online = true, // Default online status to true
//             payment_Status = true, // Default payment status to true
//             firstName,
//             lastName,
//             birthday,
//             gender,
//             telephone,
//             address,
//             isVehicleOwner,
//             profileImg,
//             nicFront,
//             nicBack,
//             licenseFront,
//             licenseBack,
//             whichVehicle,
//             vehicleNumber,
//             brand,
//             model,
//             vehicleFrontImg,
//             vehicleInsideImg,
//             vehicleOutsideImg,
//             yourVehicleOnly,
//             registered_date,
//             Points,
//             isPassanger
//         } = req.body;

//         // Generate driverId in the specified format
//         const now = new Date();
//         const date = now.toISOString().slice(5, 10).replace("-", "").replace("-", ""); 
//         const time = now.toTimeString().slice(0, 5).replace(":", "").slice(0, 2) + '.' + now.toTimeString().slice(3, 5); 
//         const driverId = `DRIVER${date}${time}`;

//         // Part 1: Save personal data (email, driverId, and additional personal details)
//         const part1Data = {
//             email: email,
//             driverId: driverId,
//             firstName,
//             lastName,
//             birthday,
//             gender,
//             telephone,
//             address,
//             isVehicleOwner,
//             profileImg,
//             nicFront,
//             nicBack,
//             licenseFront,
//             licenseBack,
//             registered_date,
//             Points,
//             isPassanger
//         };

//         // Part 2: Save vehicle-specific details
//         const part2Data = {
//             // vehicle_type: vehicle_type,
//             whichVehicle,
//             vehicleNumber,
//             brand,
//             model,
//             vehicleFrontImg,
//             vehicleInsideImg,
//             vehicleOutsideImg,
//             yourVehicleOnly
//         };

       

//         // Part 3: Save current location and isActive status (initially null for location and false for isActive)
//         const part3Data = {
//             current_location: null, 
//             isActive: false, 
//             // online: online,
//             payment_Status: payment_Status
//         };

//         // Use Firestore transaction to ensure both operations are completed together
//         const batch = db.batch();

//         // Save data to Part 1 collection (drivers_part1)
//         const part1Ref = db.collection("drivers_personal_data").doc(email);
//         batch.set(part1Ref, part1Data);

//         // Save data to Part 2 collection (drivers_part2)
//         const part2Ref = db.collection("drivers_vehicle_data").doc(email);
//         batch.set(part2Ref, part2Data);

//         // Save data to Part 3 collection (drivers_part3) for images
//         const part3Ref = db.collection("drivers_location").doc(email);
//         batch.set(part3Ref, part3Data);

//         // // Save data to Part 4 collection (drivers_part4) for current location and isActive
//         // const part4Ref = db.collection("drivers_part4").doc(email);
//         // batch.set(part4Ref, part4Data);

//         // Commit the batch operation
//         await batch.commit();

//         // Send a response after all parts are saved
//         res.send({
//             message: "Driver registered successfully",
//             data: {
//                 driverId,
//                 email,
//                 driver_name,
//                 driver_contact,
//                 current_location: null,
//                 // online,
//                 payment_Status,
//                 firstName,
//                 lastName,
//                 birthday,
//                 gender,
//                 telephone,
//                 address,
//                 isVehicleOwner,
//                 // vehicle_type,
//                 whichVehicle,
//                 vehicleNumber,
//                 brand,
//                 model,
//                 yourVehicleOnly,
//                 registered_date,
//                 Points,
//                 isPassanger
//             },
//         });
//     } catch (error) {
//         // Send a response if an error occurs
//         res.status(500).send({ error: error.message });
//     }
// };

// Register Driver correct
// const registerDriver = async (req, res) => {
//     try {
//         const {
//             email,
//             payment_Status = true,
//             firstName,
//             lastName,
//             birthday,
//             gender,
//             telephone,
//             address,
//             isVehicleOwner,
//             profileImg,
//             nicFront,
//             nicBack,
//             licenseFront,
//             licenseBack,
//             whichVehicle,
//             vehicleNumber,
//             brand,
//             model,
//             vehicleFrontImg,
//             vehicleInsideImg,
//             vehicleOutsideImg,
//             yourVehicleOnly,
//             registered_date,
//             Points,
//             isPassanger,
//             fcmToken,
//             password
//         } = req.body;

//         // Check for required fields
//         if (!email || !fcmToken) {
//             return res.status(400).send({ error: "Email and FCM token are required." });
//         }

//         // Generate unique driver ID based on current date and time
//         const now = new Date();
//         const date = now.toISOString().slice(5, 10).replace("-", "").replace("-", ""); // MMDD format
//         const time = now.toTimeString().slice(0, 5).replace(":", "").slice(0, 2) + '.' + now.toTimeString().slice(3, 5); // HH.MM format
//         const driverId = `DRIVER${date}${time}`;

//         // Part 1: Save personal data (drivers_personal_data)
//         const part1Data = {
//             email,
//             driverId,
//             payment_Status,
//             firstName,
//             lastName,
//             birthday,
//             gender,
//             telephone,
//             address,
//             isVehicleOwner,
//             profileImg,
//             nicFront,
//             nicBack,
//             licenseFront,
//             licenseBack,
//             registered_date,
//             Points,
//             isPassanger,
//             fcmToken, // Including FCM token in part 1 data
//             createdAt: now.toISOString()
//         };

//         // Part 2: Save vehicle-specific details (drivers_vehicle_data)
//         const part2Data = {
//             whichVehicle,
//             vehicleNumber,
//             brand,
//             model,
//             vehicleFrontImg,
//             vehicleInsideImg,
//             vehicleOutsideImg,
//             yourVehicleOnly
//         };

//         // Part 3: Save current location and isActive status (drivers_location)
//         const part3Data = {
//             current_location: null,
//             isActive: false,
//         };

//         // Part 4: Save the FCM token in Realtime Database
//         const fcmTokenPath = `drivers_tokens/${email.replace(/\./g, "_")}`;

//         // Batch operation for Firestore
//         const batch = firestore.batch();
        
//         // Save to Firestore collections
//         batch.set(firestore.collection("drivers_personal_data").doc(email), part1Data);
//         batch.set(firestore.collection("drivers_vehicle_data").doc(email), part2Data);
//         batch.set(firestore.collection("drivers_location").doc(email), part3Data);

//         // Save the FCM token in the Realtime Database
//         await realtimeDb.ref(fcmTokenPath).set(fcmToken);

//         // Commit the batch operation
//         await batch.commit();

//         // Respond with success
//         res.status(201).send({
//             message: "Driver registered successfully",
//             driverId,
//             email
//         });
//     } catch (error) {
//         // Handle errors and respond with a 500 status
//         res.status(500).send({ error: error.message });
//     }
// };

//new register driver 




// Login function
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const loginUser = async (req, res) => {
    try {
        // Extract phoneNumber and password from the request body
        const { phoneNumber, password } = req.body;

        // Validate request body
        if (!phoneNumber || !password) {
            return res.status(400).send({ message: "Phone number and password are required." });
        }

        // Find the user by phoneNumber in the Firestore database
        const userRef = db.collection("users").where("phoneNumber", "==", phoneNumber);
        const userSnapshot = await userRef.get();

        // Check if the user exists
        if (userSnapshot.empty) {
            return res.status(404).send({ message: "User not found." });
        }

        // Extract the user data (assuming phone numbers are unique)
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, userData.password);
        if (!isPasswordValid) {
            return res.status(401).send({ message: "Invalid phone number or password." });
        }

        // Generate a JWT token
        const token = jwt.sign(
            {
                userId: userData.userId,
                phoneNumber: userData.phoneNumber,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
            },
            process.env.JWT_SECRET, // Use an environment variable for the secret key
            { expiresIn: "1h" } // Token expires in 1 hour
        );

        // Send the response with the token and user data
        res.send({
            message: "Login successful",
            token,
            user: {
                userId: userData.userId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                phoneNumber: userData.phoneNumber,
            },
        });
    } catch (error) {
        // Send a response if an error occurs
        res.status(500).send({ error: error.message });
    }
};

//user login by phone number
const loginByPhoneNumber = async (req, res) => {
    try {
        // Extract phoneNumber from the request body
        const { phoneNumber } = req.body;

        // Validate request body
        if (!phoneNumber) {
            return res.status(400).send({ message: "Phone number is required." });
        }

        // Find the user by phoneNumber in the Firestore database
        const userRef = db.collection("users").where("phoneNumber", "==", phoneNumber);
        const userSnapshot = await userRef.get();

        // Check if the user exists
        if (userSnapshot.empty) {
            return res.status(404).send({ message: "User not found." });
        }

        // Extract the user data (assuming phone numbers are unique)
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        // Generate a JWT token
        const token = jwt.sign(
            {
                userId: userData.userId,
                phoneNumber: userData.phoneNumber,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
            },
            process.env.JWT_SECRET, // Use an environment variable for the secret key
            { expiresIn: "1h" } // Token expires in 1 hour
        );

        // Send the response with the token and user data
        res.status(200).send({
            message: "Login successful",
            token,
            user: {
                userId: userData.userId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                phoneNumber: userData.phoneNumber,
                iDnum: userData.iDnum,
                birthday: userData.birthday,
                province: userData.province,
                district: userData.district,
                profileImg: userData.profileImg,
                registed_Date: userData.registed_Date,
                points: userData.points,
                fcmToken: userData.fcmToken,
                user_role: userData.user_role,
                
            },
        });
    } catch (error) {
        console.error("Error during loginByPhoneNumber:", error);
        res.status(500).send({ error: "An error occurred during login." });
    }
};


// Get User Details (protected route)
// const getUserDetails = async (req, res) => {
//     try {
//         const email = req.user.email; 

//         // Fetch user data from part 1 (users_part1)
//         const part1Doc = await db.collection("users_part1").doc(email).get();

//         if (!part1Doc.exists) {
//             return res.status(404).send({ error: "User not found" });
//         }

//         // Fetch additional user details from part 2 (users_part2)
//         const part2Doc = await db.collection("users_part2").doc(email).get();

//         if (!part2Doc.exists) {
//             return res.status(404).send({ error: "User details not found" });
//         }

//         // Combine part 1 and part 2 data
//         const userDetails = {
//             email: part1Doc.data().email,
//             firstName: part2Doc.data().firstName,
//             lastName: part2Doc.data().lastName
//         };

//         // Send user details in response
//         res.send({
//             message: "User details fetched successfully",
//             data: userDetails
//         });

//     } catch (error) {
//         res.status(500).send({ error: error.message });
//     }
// };

const getAllUsers = async (req, res) => {
    try {
        // Fetch all users from the Firestore collection (e.g., "users")
        const usersSnapshot = await db.collection("users").get();

        // Check if there are no users in the database
        if (usersSnapshot.empty) {
            return res.status(404).send({ message: "No users found." });
        }

        // Map through the snapshot to extract user data
        const users = [];
        usersSnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });

        // Send the response with the list of users
        res.status(200).send({
            message: "Users retrieved successfully",
            data: users,
        });
    } catch (error) {
        // Handle any errors
        res.status(500).send({ error: error.message });
    }
};

const getUserByEmail = async (req, res) => {
    try {
        // Extract email from request params
        const { userId } = req.params;

        // Validate email input
        if (!userId) {
            return res.status(400).send({ error: "userId is required." });
        }

        // Fetch the user document by email
        const userDoc = await db.collection("users").doc(userId).get();

        // Check if the user exists
        if (!userDoc.exists) {
            return res.status(404).send({ error: "User not found." });
        }

        // Respond with the user data
        res.status(200).send({
            message: "User retrieved successfully",
            data: { id: userDoc.id, ...userDoc.data() },
        });
    } catch (error) {
        // Handle any errors
        res.status(500).send({ error: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if the user exists
        const userRef = firestore.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: `User with ID ${userId} not found.` });
        }

        // Save user details in the "bannedUsers" collection
        const userData = userDoc.data();
        await firestore.collection("banned_Users").doc(userId).set(userData);

        // Delete the user data from Firestore
        await userRef.delete();

        // Delete the FCM token from the Realtime Database
        const fcmTokenPath = `users_tokens/${userId}`;
        await realtimeDb.ref(fcmTokenPath).remove();

        res.status(200).send({ message: `User with ID ${userId} deleted successfully and moved to bannedUsers.` });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};




const loginUserByEmail = async (req, res) => {
    try {
        // Extract email and password from the request body
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).send({ error: "Email and password are required." });
        }

        // Check if the user exists in the database
        const userRef = db.collection("users").doc(email);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.status(400).send({ error: "Invalid email or password." });
        }

        // Get the user data
        const userData = userSnapshot.data();

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, userData.password);
        if (!isPasswordValid) {
            return res.status(400).send({ error: "Invalid email or password." });
        }

        // Generate a JWT token
        const token = jwt.sign(
            {
                userId: userData.userId,
                email: userData.email,
                userRole: userData.user_role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" } 
        );

        // Send a response with the token and user data
        res.status(200).send({
            message: "Login successful",
            token,
            data: {
                userId: userData.userId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                province: userData.province,
                district: userData.district,
                phoneNumber: userData.phoneNumber,
                profileImg: userData.profileImg,
                points: userData.points,
            },
        });
    } catch (error) {
        // Handle any errors
        res.status(500).send({ error: error.message });
    }
};

const updateUserPoints = async (req, res) => {
    try {
        // Extract userId from the request parameters and points from the request body
        const { userId } = req.params;
        const { points } = req.body;

        // Check for required fields
        if (!userId || points === undefined) {
            return res.status(400).send({ error: "User  Id and points are required." });
        }

        // Check if the user exists
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return res.status(404).send({ error: "User  not found." });
        }

        // Update the points for the user
        await userRef.update({ points });

        // Send a response after the points are updated
        res.status(200).send({
            message: "User  points updated successfully",
            data: {
                userId,
                points,
            },
        });
    } catch (error) {
        // Send a response if an error occurs
        res.status(500).send({ error: error.message });
    }
};

const getAllBannedUsers = async (req, res) => {
    try {
        // Retrieve all documents from the banned_Users collection
        const bannedUsersSnapshot = await firestore.collection("banned_Users").get();

        // Check if there are any banned users
        if (bannedUsersSnapshot.empty) {
            return res.status(404).send({ message: "No banned users found." });
        }

        // Map through the documents and extract the data
        const bannedUsers = bannedUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // Send the list of banned users in the response
        res.status(200).send({
            message: "Banned users retrieved successfully.",
            data: bannedUsers,
        });
    } catch (error) {
        // Send a response if an error occurs
        res.status(500).send({ error: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;

        if (!userId) {
            return res.status(400).send({ error: "User ID is required." });
        }

        // Reference to the user's document
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ error: "User not found." });
        }

        const existingUserData = userDoc.data();

        // Check if the updated email already exists (if provided)
        if (updateData.email && updateData.email !== existingUserData.email) {
            const existingUserByEmail = await db
                .collection("users")
                .where("email", "==", updateData.email)
                .get();
            if (!existingUserByEmail.empty) {
                return res.status(400).send({ error: "A user with this email already exists." });
            }
        }

        // Check if the updated phone number already exists (if provided)
        if (updateData.phoneNumber && updateData.phoneNumber !== existingUserData.phoneNumber) {
            const existingUserByPhone = await db
                .collection("users")
                .where("phoneNumber", "==", updateData.phoneNumber)
                .get();
            if (!existingUserByPhone.empty) {
                return res.status(400).send({ error: "A user with this phone number already exists." });
            }
        }

        // If updating the password, hash the new password
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        // Update the user's document in Firestore
        await userRef.update(updateData);

        res.status(200).send({
            message: "User updated successfully",
            userId,
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};


module.exports = {
    createUser,
    registerUser,
    getUserByEmail,
    loginUser,
    getAllUsers,
    deleteUser,
    loginByPhoneNumber,
    loginUserByEmail,
    updateUserPoints,
    getAllBannedUsers,
    updateUser
};
