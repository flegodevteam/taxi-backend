const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const { admin } = require("./firebase/firebaseConfig"); // Ensure Firebase is correctly imported

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // Create WebSocket server

const allowedOrigins = [
  "http://localhost:5173", 
  "https://taxi-dashboard-five.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const { getRideRequestsForDriver } = require("./controllers/RideController");

const userRoutes = require("./Routes/userRoutes");
const rideRoutes = require("./Routes/rideRoutes");
const VehicleRoutes = require("./Routes/VehicleRoutes");
const CalculationRoutes = require("./Routes/CalculationRoutes");
const driverRoutes = require("./Routes/driverRoutes");
const adminRouters = require("./Routes/adminRouter");
const complainRoutes = require("./Routes/complainRoutes");
const sosRoutes = require("./Routes/sosRoutes");

app.use("/api/user", userRoutes);
app.use("/api/ride", rideRoutes);
app.use("/api/vehicle", VehicleRoutes);
app.use("/api/cal", CalculationRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/admin", adminRouters);
app.use("/api/complain", complainRoutes);
app.use("/api/sos", sosRoutes);

// WebSocket Server Connection
wss.on("connection", (ws) => {
  console.log("New WebSocket connection established.");

  // Heartbeat to prevent timeouts
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (!client.isAlive) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000); // Ping every 30 seconds

  ws.on("message", async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      
      if (parsedMessage.driverId) {
        // Handle fetching ride requests for a driver
        getRideRequestsForDriver(ws, parsedMessage.driverId);
      } else if (parsedMessage.userId) {
        // Handle fetching the latest ride for a user
        const userId = parsedMessage.userId;

        try {
          const rideDetails = await getLatestRideByUser(userId);
          
          if (!rideDetails) {
            ws.send(JSON.stringify({ message: "No ride found for the provided userId." }));
          } else {
            ws.send(JSON.stringify({ message: "Ride details", rideDetails }));
          }
        } catch (error) {
          console.error("Error fetching ride details:", error);
          ws.send(JSON.stringify({ error: "Failed to fetch ride details." }));
        }
      } else {
        ws.send(JSON.stringify({ error: "Invalid request. Provide either driverId or userId." }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ error: "Invalid JSON format." }));
    }
  });

  ws.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  ws.on("error", () => {
    clearInterval(heartbeatInterval);
  });
});





app.get("/", (req, res) => {
  res.json({ message: "Hello World from Backend" });
});

const PORT = process.env.PORT || 8000;

// Start the server with WebSocket support
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
