const express = require("express");
const app = express();
const cors = require("cors");


// Import Firestore and Realtime Database references from firebaseConfig.js
const { firestore, realtimeDb } = require("./firebase/firebaseConfig"); // Adjust the path if needed

require("dotenv").config();

const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://taxi-dashboard-five.vercel.app", // Production frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g., mobile apps, curl requests)
      if (!origin) return callback(null, true);

      // Check if the origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers)
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const userRoutes = require("./Routes/userRoutes");
const rideRoutes = require("./Routes/rideRoutes");
const VehicleRoutes = require("./Routes/VehicleRoutes");
const CalculationRoutes = require("./Routes/CalculationRoutes");
const driverRoutes = require("./Routes/driverRoutes");
const adminRouters = require("./Routes/adminRouter");
const complainRoutes = require("./Routes/complainRoutes");
const sosRoutes = require("./Routes/sosRoutes");



// Use routes
app.use("/api/user", userRoutes);
app.use("/api/ride", rideRoutes);
app.use("/api/vehicle", VehicleRoutes);CalculationRoutes
app.use("/api/cal", CalculationRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/admin",adminRouters)
app.use("/api/complain",complainRoutes)
app.use("/api/sos",sosRoutes)



const PORT = process.env.PORT || 8000;

app.get("/",(req,res) => {
    res.json({message:"Hello Worlf from Backend"});
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
