const express = require("express");
const router = express.Router();
const { createEmergencyEntry,getAllEmergencyEntries } = require("../controllers/sosController");

// Route to create an emergency entry
router.post("/create-emergency", createEmergencyEntry);

router.get("/get-all-emergencies", getAllEmergencyEntries);

module.exports = router;
