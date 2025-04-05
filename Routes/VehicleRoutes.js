const express = require("express");
const {
  addVehiclePackage,
  getAllVehiclePackages,
  getVehiclePackageById,
  updateVehiclePackage,
  deleteVehiclePackage,
  getVehiclePackageByVehicleType,
  getAvailableVehicleTypes,
  addVehicleType,
  addAllVehicleTypes
} = require("../controllers/vehicleController");
const {authenticateToken} = require("../Middleware/Auth")


const router = express.Router();

// Add a new vehicle package
router.post("/add-vehicle-package",authenticateToken, addVehiclePackage);

// Get all vehicle packages
router.get("/vehicle-packages", authenticateToken,getAllVehiclePackages);

// Get a single vehicle package by ID
router.get("/vehicle-packages/:id", authenticateToken,getVehiclePackageById);

// Update a vehicle package by ID
router.put("/vehicle-packages/:id", authenticateToken,updateVehiclePackage);

// Delete a vehicle package by ID
router.delete("/vehicle-packages/:id",authenticateToken, deleteVehiclePackage);

router.get("/vehicle-packages-by-vehicle/:vehicle_type",getVehiclePackageByVehicleType);

// Get available vehicle types
router.get("/vehicle-types", authenticateToken, getAvailableVehicleTypes);

router.post('/add-vehicle-type', authenticateToken, addVehicleType);

router.post('/add-all-vehicle-types', authenticateToken, addAllVehicleTypes);


module.exports = router;
