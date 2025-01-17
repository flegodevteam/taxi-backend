const express = require('express');
const { calculateFullCost } = require('../controllers/CalculationController'); // Adjust the import path as needed

const router = express.Router();

// Define the route to calculate full cost
router.post('/calculate-full-cost', calculateFullCost);

module.exports = router;
