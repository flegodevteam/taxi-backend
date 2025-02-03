const { firestore } = require('../firebase/firebaseConfig');
const admin = require('firebase-admin');
const geolib = require('geolib');

const calculateFullCost = async (req, res) => {
  try {
    const { pickup_location, dropped_location, vehicle_type, waiting_time } = req.body;

    // Validate input fields
    if (!pickup_location || !dropped_location || !vehicle_type || waiting_time == null) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Calculate the distance between pickup and dropped locations in kilometers
    const distanceInMeters = geolib.getDistance(
      { latitude: pickup_location.latitude, longitude: pickup_location.longitude },
      { latitude: dropped_location.latitude, longitude: dropped_location.longitude }
    );
    const distanceInKm = distanceInMeters / 1000;

    const allPackagesSnapshot = await firestore.collection('vehicle_packages').get();

    console.log("All Vehicle Packages:");
    allPackagesSnapshot.forEach(doc => {
      console.log(`ID: ${doc.id}`, doc.data());
    });
    // Fetch vehicle package details based on vehicle_type
    const packageSnapshot = await firestore
      .collection('vehicle_packages')
      .where('vehicle_type', '==', vehicle_type)
      .get();

    if (packageSnapshot.empty) {
      return res.status(404).json({ error: "Vehicle type not found." });
    }

    const vehiclePackage = packageSnapshot.docs[0].data();
    const { first_3km_cost, after_cost, waiting_time_cost } = vehiclePackage;

    // Calculate the full cost
    let fullCost = 0;

    // Cost for the first 3km
    if (distanceInKm <= 3) {
      fullCost += first_3km_cost;
    } else {
      fullCost += first_3km_cost;
      const remainingDistance = distanceInKm - 3;
      fullCost += Math.ceil(remainingDistance) * after_cost;
    }

    // Add waiting time cost
    const waitingCost = (waiting_time / 60) * waiting_time_cost;
    fullCost += waitingCost;

    // Return the calculated cost
    return res.status(200).json({
      message: "Full cost calculated successfully.",
      data: {
        distance: distanceInKm.toFixed(2),
        fullCost: fullCost.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error calculating full cost:", error);
    return res.status(500).json({ error: "Failed to calculate full cost." });
  }
};

const calculateFullCost2 = async (params) => {
  try {
    const { pickup_location, dropped_location, vehicle_type, waiting_time } = params;

    // Validate input fields
    if (!pickup_location || !dropped_location || !vehicle_type || waiting_time == null) {
      throw new Error("All fields are required.");
    }

    // Calculate the distance between pickup and dropped locations in kilometers
    const distanceInMeters = geolib.getDistance(
      { latitude: pickup_location.latitude, longitude: pickup_location.longitude },
      { latitude: dropped_location.latitude, longitude: dropped_location.longitude }
    );
    const distanceInKm = distanceInMeters / 1000;

    // Fetch vehicle package details based on vehicle_type
    const packageSnapshot = await firestore
      .collection('vehicle_packages')
      .where('vehicle_type', '==', vehicle_type)
      .get();

    if (packageSnapshot.empty) {
      throw new Error("Vehicle type not found.");
    }

    const vehiclePackage = packageSnapshot.docs[0].data();
    const { first_3km_cost, after_cost, waiting_time_cost } = vehiclePackage;

    // Calculate the full cost
    let fullCost = 0;

    // Cost for the first 3km
    if (distanceInKm <= 3) {
      fullCost += first_3km_cost;
    } else {
      fullCost += first_3km_cost;
      const remainingDistance = distanceInKm - 3;
      fullCost += Math.ceil(remainingDistance) * after_cost;
    }

    // Add waiting time cost
    const waitingCost = (waiting_time / 60) * waiting_time_cost;
    fullCost += waitingCost;

    // Return the calculated cost
    return {
      distance: distanceInKm,
      fullCost: fullCost,
    };
  } catch (error) {
    console.error("Error calculating full cost:", error);
    throw error; // Re-throw the error for handling in the calling function
  }
};

module.exports = {
  calculateFullCost,calculateFullCost2
};
