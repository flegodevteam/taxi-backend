const express = require('express');
const { calculateFullCost,calculateFullCost2,calculateFullCost3 } = require('../controllers/CalculationController'); // Adjust the import path as needed

const router = express.Router();

// Define the route to calculate full cost
router.post('/calculate-full-cost', calculateFullCost);

router.post('/calculate-full-cost2', calculateFullCost2); // Route for calculateFullCost2
router.post('/calculate-full-cost3', calculateFullCost3); // Route for calculateFullCost3

module.exports = router;
