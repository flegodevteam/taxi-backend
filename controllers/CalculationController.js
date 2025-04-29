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
  console.log("params", params);

  try {
    const { distanceInKm, vehicle_type, waiting_time } = params;

    // Validate input fields
    if (distanceInKm == null || !vehicle_type || waiting_time == null) {
      throw new Error("All fields are required.");
    }

    console.log("distanceInKm", distanceInKm);

    // Fetch vehicle package details based on vehicle_type
    const packageSnapshot = await firestore
      .collection("vehicle_packages")
      .where("vehicle_type", "==", vehicle_type)
      .get();

    if (packageSnapshot.empty) {
      throw new Error("Vehicle type not found.");
    }

    const vehiclePackage = packageSnapshot.docs[0].data();

    console.log("vehiclePackage", vehiclePackage);

    // Convert string values to numbers for calculations
    const first_3km_cost = Number(vehiclePackage.first_3km_cost);
    const after_cost = Number(vehiclePackage.after_cost);
    const waiting_time_cost = Number(vehiclePackage.waiting_time_cost);
    const numericDistance = Number(distanceInKm);
    const numericWaitingTime = Number(waiting_time);

    // Check if any conversion resulted in NaN
    if (isNaN(first_3km_cost) || isNaN(after_cost) || isNaN(waiting_time_cost) || isNaN(numericDistance) || isNaN(numericWaitingTime)) {
      throw new Error("Invalid numeric values detected in vehicle package or parameters.");
    }

    let fullCost = 0;

    // Cost for the first 3km
    if (numericDistance <= 3) {
      fullCost += first_3km_cost;
    } else {
      fullCost += first_3km_cost; // First 3km cost
      const remainingDistance = numericDistance - 3;
      fullCost += Math.ceil(remainingDistance) * after_cost; // Cost for extra km
    }

    // Add waiting time cost
    const waitingCost = (numericWaitingTime / 60) * waiting_time_cost;
    fullCost += waitingCost;

    console.log("fullCost", fullCost); // This should now correctly log 9946

    // Return the calculated cost
    return {
      distance: numericDistance,
      fullCost: fullCost,
    };
  } catch (error) {
    console.error("Error calculating full cost:", error);
    throw error; // Re-throw the error for handling in the calling function
  }
};
const calculateFullCost3 = async (req, res) => {
  try {
    const { pickup_location, dropped_location, vehicle_type, waiting_time, vehicle_weight } = req.body;

    // Validate input fields
    if (!pickup_location || !dropped_location || !vehicle_type || waiting_time == null || vehicle_weight == null) {
      return res.status(400).json({ error: "All fields are required." });
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
      return res.status(404).json({ error: "Vehicle type not found." });
    }

    const vehiclePackage = packageSnapshot.docs[0].data();
    const { first_3km_cost, after_cost, waiting_time_cost, weight_surcharge_rate } = vehiclePackage;

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

    // Add surcharge based on vehicle weight
    const weightSurcharge = vehicle_weight * weight_surcharge_rate;
    fullCost += weightSurcharge;

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

const calculateRideCost = async ({
  pickup_location,
  dropped_location,
  vehicle_type,
  waiting_time = 0,
  vehicle_weight = 0,
  isReturnTrip = false
}) => {
  const distanceMeters = geolib.getDistance(pickup_location, dropped_location);
  let totalDistanceKm = distanceMeters / 1000;

  if (isReturnTrip) {
    totalDistanceKm *= 2;
  }

  const packageSnapshot = await firestore
    .collection("vehicle_packages_new")
    .where("vehicle_type", "==", vehicle_type)
    .limit(1)
    .get();

  if (packageSnapshot.empty) {
    throw new Error("Vehicle type not found.");
  }

  const packageData = packageSnapshot.docs[0].data();
  const {
    base_distance_km,
    first_base_cost,
    after_cost,
    waiting_time_cost,
    weight_surcharge_rate = 0,
  } = packageData;

  if (
    isNaN(base_distance_km) || isNaN(first_base_cost) ||
    isNaN(after_cost) || isNaN(waiting_time_cost)
  ) {
    throw new Error("Invalid vehicle package data.");
  }

  let fullCost = first_base_cost;
  let extraKm = 0;
  if (totalDistanceKm > base_distance_km) {
    extraKm = totalDistanceKm - base_distance_km;
    fullCost += Math.ceil(extraKm) * after_cost;
  }

  const waitingCost = (waiting_time / 60) * waiting_time_cost;
  fullCost += waitingCost;

  const weightCost = vehicle_weight * weight_surcharge_rate;
  fullCost += weightCost;

  return {
    totalDistanceKm: totalDistanceKm.toFixed(2),
    fullCost: fullCost.toFixed(2),
    breakdown: {
      baseDistanceKm: base_distance_km,
      extraDistanceKm: extraKm.toFixed(2),
      extraDistanceCost: (Math.ceil(extraKm) * after_cost).toFixed(2),
      waitingCost: waitingCost.toFixed(2),
      weightCost: weightCost.toFixed(2),
    }
  };
};

const calculateExtraDistanceCost = async (params) => {
  const { extraDistanceKm, vehicle_type } = params;

  if (!extraDistanceKm || !vehicle_type) {
    throw new Error("extraDistanceKm and vehicle_type are required.");
  }

  try {
    // Fetch vehicle package
    const packageSnapshot = await firestore
      .collection("vehicle_packages_new")
      .where("vehicle_type", "==", vehicle_type)
      .get();

    if (packageSnapshot.empty) {
      throw new Error("Vehicle type not found.");
    }

    const vehiclePackage = packageSnapshot.docs[0].data();
    const { after_cost } = vehiclePackage;

    if (isNaN(extraDistanceKm) || isNaN(after_cost)) {
      throw new Error("Invalid numeric values.");
    }

    const roundedDistance = Math.ceil(extraDistanceKm); // Round up to charge full km
    const extraCost = roundedDistance * after_cost;

    return {
      extraDistanceKm: roundedDistance,
      extraCost: extraCost.toFixed(2),
    };
  } catch (error) {
    console.error("❌ Error in calculateExtraDistanceCost:", error.message);
    throw error;
  }
};

const calculateDynamicRideCost = async (params) => {
  try {
    const {
      pickup_location,
      dropped_location,
      mid_trip_location = null,     // optional: new stop during trip
      after_reach_location = null,  // optional: after reaching new extra
      vehicle_type,
      waiting_time = 0,
      vehicle_weight = 0,
      isReturnTrip = false,
    } = params;

    if (!pickup_location || !dropped_location || !vehicle_type) {
      throw new Error("pickup_location, dropped_location and vehicle_type are required.");
    }

    let totalDistanceKm = 0;

    // 1. Pickup → Drop
    const firstLeg = geolib.getDistance(pickup_location, dropped_location);
    totalDistanceKm += firstLeg / 1000;

    // 2. If mid-trip stop: Drop → Mid-Trip
    if (mid_trip_location) {
      const midLeg = geolib.getDistance(dropped_location, mid_trip_location);
      totalDistanceKm += midLeg / 1000;
    }

    // 3. After trip new location
    if (after_reach_location) {
      const afterStart = mid_trip_location || dropped_location;
      const afterLeg = geolib.getDistance(afterStart, after_reach_location);
      totalDistanceKm += afterLeg / 1000;
    }

    // 4. If return trip, double distance
    if (isReturnTrip) {
      totalDistanceKm *= 2;
    }

    console.log("🚗 Total Distance (km):", totalDistanceKm.toFixed(2));

    // 5. Fetch pricing package
    const packageSnapshot = await firestore
      .collection('vehicle_packages_new')
      .where('vehicle_type', '==', vehicle_type)
      .limit(1)
      .get();

    if (packageSnapshot.empty) {
      throw new Error("Vehicle type not found.");
    }

    const packageData = packageSnapshot.docs[0].data();
    const {
      base_distance_km,
      first_base_cost,
      after_cost,
      waiting_time_cost,
      weight_surcharge_rate = 0,
    } = packageData;

    if (isNaN(base_distance_km) || isNaN(first_base_cost) || isNaN(after_cost)) {
      throw new Error("Invalid package data.");
    }

    // 6. Cost calculation
    let fullCost = 0;

    if (totalDistanceKm <= base_distance_km) {
      fullCost += first_base_cost;
    } else {
      fullCost += first_base_cost;
      const extraKm = totalDistanceKm - base_distance_km;
      fullCost += Math.ceil(extraKm) * after_cost;
    }

    // Waiting time cost
    const waitingCost = (waiting_time / 60) * waiting_time_cost;
    fullCost += waitingCost;

    // Weight surcharge cost
    const weightCost = vehicle_weight * weight_surcharge_rate;
    fullCost += weightCost;

    // 7. Final result
    return {
      totalDistanceKm: totalDistanceKm.toFixed(2),
      fullCost: fullCost.toFixed(2),
      breakdown: {
        baseDistanceKm: base_distance_km,
        extraDistanceKm: (totalDistanceKm > base_distance_km) ? (totalDistanceKm - base_distance_km).toFixed(2) : "0.00",
        extraDistanceCost: (totalDistanceKm > base_distance_km) ? (Math.ceil(totalDistanceKm - base_distance_km) * after_cost).toFixed(2) : "0.00",
        waitingCost: waitingCost.toFixed(2),
        weightCost: weightCost.toFixed(2),
      }
    };
  } catch (error) {
    console.error("❌ Error calculating dynamic ride cost:", error.message);
    throw error;
  }
};

module.exports = {
  calculateFullCost,calculateFullCost2,calculateFullCost3,calculateRideCost ,calculateExtraDistanceCost,calculateDynamicRideCost
};
