const express = require("express");
const app = express();

// Import Firestore and Realtime Database references from firebaseConfig.js
const { firestore, realtimeDb } = require("./firebase/firebaseConfig"); // Adjust the path if needed

require("dotenv").config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const userRoutes = require("./Routes/userRoutes");
const rideRoutes = require("./Routes/rideRoutes");
const VehicleRoutes = require("./Routes/VehicleRoutes");
const CalculationRoutes = require("./Routes/CalculationRoutes");
const driverRoutes = require("./Routes/driverRoutes");

// Use routes
app.use("/api/user", userRoutes);
app.use("/api/ride", rideRoutes);
app.use("/api/vehicle", VehicleRoutes);CalculationRoutes
app.use("/api/cal", CalculationRoutes);
app.use("/api/driver", driverRoutes);


const PORT = process.env.PORT || 8000;

app.get("/",(req,res) => {
    res.json({message:"Hello Worlf from Backend"});
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
