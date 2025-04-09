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
  addAllVehicleTypes,

  addVehiclePackageNew,
  updateVehiclePackageNew,
  getAllVehiclePackagesNew,
  getVehiclePackageByVehicleTypeNew,
  getVehiclePackageByIdNew,
  deleteVehiclePackageNew
} = require("../controllers/vehicleController");

const { authenticateToken } = require("../Middleware/Auth");

const router = express.Router();

// Existing routes (no changes)
router.post("/add-vehicle-package", authenticateToken, addVehiclePackage);
router.get("/vehicle-packages", authenticateToken, getAllVehiclePackages);
router.get("/vehicle-packages/:id", authenticateToken, getVehiclePackageById);
router.put("/vehicle-packages/:id", authenticateToken, updateVehiclePackage);
router.delete("/vehicle-packages/:id", authenticateToken, deleteVehiclePackage);
router.get("/vehicle-packages-by-vehicle/:vehicle_type", getVehiclePackageByVehicleType);
router.get("/vehicle-types", authenticateToken, getAvailableVehicleTypes);
router.post('/add-vehicle-type', authenticateToken, addVehicleType);
router.post('/add-all-vehicle-types', authenticateToken, addAllVehicleTypes);

// New routes for added functionality (with "New" suffix)
router.post("/add-vehicle-package-new", authenticateToken, addVehiclePackageNew);  // Add new vehicle package
router.put("/vehicle-packages-new/:id", authenticateToken, updateVehiclePackageNew);  // Update vehicle package by ID
router.get("/vehicle-packages-new", authenticateToken, getAllVehiclePackagesNew);  // Get all vehicle packages
router.get("/vehicle-packages-new/:id", authenticateToken, getVehiclePackageByIdNew);  // Get single vehicle package by ID
router.delete("/vehicle-packages-new/:id", authenticateToken, deleteVehiclePackageNew);  // Delete vehicle package by ID
router.get("/vehicle-packages-by-vehicle-new/:vehicle_type", authenticateToken, getVehiclePackageByVehicleTypeNew);  // Get by vehicle type

module.exports = router;
