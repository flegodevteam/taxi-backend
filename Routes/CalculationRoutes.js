const express = require('express');
const { calculateFullCost,calculateFullCost2,calculateFullCost3,calculateRideCost, calculateExtraDistanceCost,calculateDynamicRideCost } = require('../controllers/CalculationController'); // Adjust the import path as needed

const router = express.Router();

// Define the route to calculate full cost
router.post('/calculate-full-cost', calculateFullCost);

router.post('/calculate-full-cost2', calculateFullCost2); // Route for calculateFullCost2
router.post('/calculate-full-cost3', calculateFullCost3); // Route for calculateFullCost3




router.post('/calculate-extra-distance-cost', async (req, res) => {
    try {
      const { calculateExtraDistanceCost } = require('../controllers/CalculationController');
      const result = await calculateExtraDistanceCost(req.body);
      res.status(200).json({ message: "Extra cost calculated successfully.", data: result });
    } catch (error) {
      console.error("❌ Error in /calculate-extra-distance-cost:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/calculate-dynamic-ride-cost', async (req, res) => {
    try {
      const result = await calculateDynamicRideCost(req.body);
      res.status(200).json({ message: "Dynamic ride cost calculated successfully.", data: result });
    } catch (error) {
      console.error("❌ Error in /calculate-dynamic-ride-cost:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // New route for calculateFullCostNew
router.post('/calculate-full-cost-new', calculateRideCost);  // Added the new calculation route

module.exports = router;
