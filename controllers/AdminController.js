const bcrypt = require("bcrypt");
const admin = require("firebase-admin");
const db = admin.firestore();
const registerAdmin = async (req, res) => {
    try {
        // Extract data from the request body
        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            nic,
            userRole
        } = req.body;

        // Check for required fields
        if (!email || !password || !userRole) {
            return res.status(400).send({ error: "Email, password, and user role are required." });
        }

        // Check if email already exists
        const existingAdmin = await db.collection("admins").doc(email).get();
        if (existingAdmin.exists) {
            return res.status(400).send({ error: "An admin with this email already exists. Please use a different email." });
        }

        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin data object
        const adminData = {
            firstName,
            lastName,
            email,
            phoneNumber,
            password: hashedPassword,
            nic,
            userRole
        };

        // Save data to the Firestore collection (e.g., "admins")
        const adminRef = db.collection("admins").doc(email);
        await adminRef.set(adminData);

        // Send a success response
        res.status(201).send({
            message: "Admin registered successfully",
            data: {
                firstName,
                lastName,
                email,
                phoneNumber,
                nic,
                userRole
            },
        });
    } catch (error) {
        // Handle errors
        res.status(500).send({ error: error.message });
    }
};


const jwt = require("jsonwebtoken");


const loginAdmin = async (req, res) => {
    try {
        // Extract data from the request body
        const { email, password } = req.body;

        // Check for required fields
        if (!email || !password) {
            return res.status(400).send({ error: "Email and password are required." });
        }

        // Check if email exists in Firestore
        const adminRef = await db.collection("admins").doc(email).get();
        if (!adminRef.exists) {
            return res.status(400).send({ error: "No admin found with this email." });
        }

        const adminData = adminRef.data();

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, adminData.password);
        if (!isPasswordValid) {
            return res.status(400).send({ error: "Invalid password." });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                email: adminData.email,
                userRole: adminData.userRole,
            },
            process.env.JWT_SECRET, // Ensure you have a secret key in environment variables
            { expiresIn: "1h" } // Token expires in 1 hour
        );

        // Password is valid, send a success response with the token
        res.status(200).send({
            message: "Login successful",
            token,
            data: {
                firstName: adminData.firstName,
                lastName: adminData.lastName,
                email: adminData.email,
                phoneNumber: adminData.phoneNumber,
                nic: adminData.nic,
                userRole: adminData.userRole,
            },
        });
    } catch (error) {
        // Handle errors
        res.status(500).send({ error: error.message });
    }
};




module.exports = {registerAdmin,loginAdmin};