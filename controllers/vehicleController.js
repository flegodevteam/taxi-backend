const { firestore } = require('../firebase/firebaseConfig');
const admin = require('firebase-admin');

// Create (Add) a new vehicle package
const addVehiclePackage = async (req, res) => {
  try {
    const { vehicle_type, first_3km_cost, after_cost, waiting_time_cost } = req.body;

    if (!vehicle_type || !first_3km_cost || !after_cost || !waiting_time_cost) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const newPackage = {
      vehicle_type,
      first_3km_cost,
      after_cost,
      waiting_time_cost,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore.collection("vehicle_packages_new").add(newPackage);
    const addedPackage = await docRef.get();

    return res.status(201).json({
      message: "Vehicle package added successfully.",
      packageId: docRef.id,
      data: addedPackage.data(),
    });
  } catch (error) {
    console.error("Error adding vehicle package:", error);
    return res.status(500).json({ error: "Failed to add vehicle package." });
  }
};


// Add a new vehicle type
const addVehicleType = async (req, res) => {
  try {
    const { vehicle_type } = req.body;

    if (!vehicle_type) {
      return res.status(400).json({ error: "Vehicle type is required." });
    }

    // Check if the vehicle type already exists in the collection
    const snapshot = await firestore
      .collection('vehicle_packages_new')
      .where('vehicle_type', '==', vehicle_type)
      .get();

    if (!snapshot.empty) {
      return res.status(400).json({ error: "Vehicle type already exists." });
    }

    // Add new vehicle type to the collection
    await firestore.collection('vehicle_types').add({
      vehicle_type,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      message: `Vehicle type '${vehicle_type}' added successfully.`,
    });
  } catch (error) {
    console.error("Error adding vehicle type:", error);
    return res.status(500).json({ error: "Failed to add vehicle type." });
  }
};
// Read (Get) all vehicle packages
const getAllVehiclePackages = async (req, res) => {
  try {
    const snapshot = await firestore.collection("vehicle_packages_new").get();
    if (snapshot.empty) {
      return res.status(404).json({ message: "No vehicle packages found." });
    }

    const packages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(packages);
  } catch (error) {
    console.error("Error fetching vehicle packages:", error);
    return res.status(500).json({ error: "Failed to fetch vehicle packages." });
  }
};

// Read (Get) a single vehicle package by ID
const getVehiclePackageById = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = firestore.collection("vehicle_packages_new").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vehicle package not found." });
    }

    return res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching vehicle package:", error);
    return res.status(500).json({ error: "Failed to fetch vehicle package." });
  }
};

// Update a vehicle package by ID
const updateVehiclePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_type, first_3km_cost, after_cost, waiting_time_cost } = req.body;

    if (!vehicle_type && !first_3km_cost && !after_cost && !waiting_time_cost) {
      return res.status(400).json({ error: "At least one field is required to update." });
    }

    const updates = {
      ...(vehicle_type && { vehicle_type }),
      ...(first_3km_cost && { first_3km_cost }),
      ...(after_cost && { after_cost }),
      ...(waiting_time_cost && { waiting_time_cost }),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = firestore.collection("vehicle_packages_new").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vehicle package not found." });
    }

    await docRef.update(updates);
    const updatedDoc = await docRef.get();

    return res.status(200).json({
      message: "Vehicle package updated successfully.",
      data: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (error) {
    console.error("Error updating vehicle package:", error);
    return res.status(500).json({ error: "Failed to update vehicle package." });
  }
};

// Delete a vehicle package by ID
const deleteVehiclePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = firestore.collection("vehicle_packages_new").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vehicle package not found." });
    }

    await docRef.delete();
    return res.status(200).json({ message: "Vehicle package deleted successfully." });
  } catch (error) {
    console.error("Error deleting vehicle package:", error);
    return res.status(500).json({ error: "Failed to delete vehicle package." });
  }
};


// Get vehicle package details by vehicle_type
const getVehiclePackageByVehicleType = async (req, res) => {
  try {
    const { vehicle_type } = req.params;

    if (!vehicle_type) {
      return res.status(400).json({ error: "Vehicle type is required." });
    }

    const snapshot = await firestore
      .collection("vehicle_packages_new")
      .where("vehicle_type", "==", vehicle_type)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No vehicle packages found for the specified vehicle type." });
    }

    const packages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(packages);
  } catch (error) {
    console.error("Error fetching vehicle packages by type:", error);
    return res.status(500).json({ error: "Failed to fetch vehicle packages by type." });
  }
};


const getAvailableVehicleTypes = async (req, res) => {
  try {
    const snapshot = await firestore.collection('vehicle_packages_new').get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "No vehicle types found." });
    }

    const vehicleTypes = [];
    snapshot.forEach(doc => {
      const vehiclePackage = doc.data();
      if (vehiclePackage.vehicle_type && !vehicleTypes.includes(vehiclePackage.vehicle_type)) {
        vehicleTypes.push(vehiclePackage.vehicle_type);
      }
    });

    return res.status(200).json({
      message: "Available vehicle types retrieved successfully.",
      data: vehicleTypes,
    });
  } catch (error) {
    console.error("Error retrieving vehicle types:", error);
    return res.status(500).json({ error: "Failed to retrieve vehicle types." });
  }
};
// Add all vehicle types from the 'vehicle_packages_new' collection to 'vehicle_types'
const addAllVehicleTypes = async (req, res) => {
  try {
    // Fetch all vehicle packages
    const snapshot = await firestore.collection('vehicle_packages_new').get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "No vehicle packages found." });
    }

    const vehicleTypes = new Set(); // Use a Set to ensure unique vehicle types

    snapshot.forEach(doc => {
      const vehiclePackage = doc.data();
      if (vehiclePackage.vehicle_type) {
        vehicleTypes.add(vehiclePackage.vehicle_type); // Add vehicle type to the set
      }
    });

    if (vehicleTypes.size === 0) {
      return res.status(400).json({ error: "No vehicle types found in the vehicle packages." });
    }

    // Add the vehicle types to the 'vehicle_types' collection
    const batch = firestore.batch();
    vehicleTypes.forEach(vehicleType => {
      const vehicleTypeRef = firestore.collection('vehicle_types').doc(vehicleType); // Use vehicle_type as the document ID
      batch.set(vehicleTypeRef, { vehicle_type: vehicleType, created_at: admin.firestore.FieldValue.serverTimestamp() });
    });

    // Commit the batch write
    await batch.commit();

    return res.status(201).json({
      message: "All vehicle types added successfully.",
      vehicle_types: Array.from(vehicleTypes), // Convert Set to Array
    });
  } catch (error) {
    console.error("Error adding vehicle types:", error);
    return res.status(500).json({ error: "Failed to add vehicle types." });
  }
};

const addVehiclePackageNew = async (req, res) => {
  try {
    const { vehicle_type, base_distance_km, first_base_cost, after_cost, waiting_time_cost } = req.body;

    if (!vehicle_type || !base_distance_km || !first_base_cost || !after_cost || !waiting_time_cost) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const newPackage = {
      vehicle_type,
      base_distance_km,        // Added base_distance_km
      first_base_cost,         // Added first_base_cost
      after_cost,              // Added after_cost
      waiting_time_cost,       // Added waiting_time_cost
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore.collection("vehicle_packages_new").add(newPackage);
    const addedPackage = await docRef.get();

    return res.status(201).json({
      message: "Vehicle package added successfully.",
      packageId: docRef.id,
      data: addedPackage.data(),
    });
  } catch (error) {
    console.error("Error adding vehicle package:", error);
    return res.status(500).json({ error: "Failed to add vehicle package." });
  }
};
const updateVehiclePackageNew = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_type, base_distance_km, first_base_cost, after_cost, waiting_time_cost } = req.body;

    if (!vehicle_type && !base_distance_km && !first_base_cost && !after_cost && !waiting_time_cost) {
      return res.status(400).json({ error: "At least one field is required to update." });
    }

    const updates = {
      ...(vehicle_type && { vehicle_type }),
      ...(base_distance_km && { base_distance_km }),          // Added base_distance_km
      ...(first_base_cost && { first_base_cost }),            // Added first_base_cost
      ...(after_cost && { after_cost }),                      // Added after_cost
      ...(waiting_time_cost && { waiting_time_cost }),        // Added waiting_time_cost
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = firestore.collection("vehicle_packages_new").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vehicle package not found." });
    }

    await docRef.update(updates);
    const updatedDoc = await docRef.get();

    return res.status(200).json({
      message: "Vehicle package updated successfully.",
      data: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (error) {
    console.error("Error updating vehicle package:", error);
    return res.status(500).json({ error: "Failed to update vehicle package." });
  }
};
const getAllVehiclePackagesNew = async (req, res) => {
  try {
    const snapshot = await firestore.collection("vehicle_packages_new").get();
    if (snapshot.empty) {
      return res.status(404).json({ message: "No vehicle packages found." });
    }

    const packages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(packages);
  } catch (error) {
    console.error("Error fetching vehicle packages:", error);
    return res.status(500).json({ error: "Failed to fetch vehicle packages." });
  }
};

const getVehiclePackageByVehicleTypeNew = async (req, res) => {
  try {
    const { vehicle_type } = req.params;

    if (!vehicle_type) {
      return res.status(400).json({ error: "Vehicle type is required." });
    }

    const snapshot = await firestore
      .collection("vehicle_packages_new")
      .where("vehicle_type", "==", vehicle_type)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No vehicle packages found for the specified vehicle type." });
    }

    const packages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(packages);
  } catch (error) {
    console.error("Error fetching vehicle packages by type:", error);
    return res.status(500).json({ error: "Failed to fetch vehicle packages by type." });
  }
};

const getVehiclePackageByIdNew = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = firestore.collection("vehicle_packages_new").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vehicle package not found." });
    }

    return res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching vehicle package:", error);
    return res.status(500).json({ error: "Failed to fetch vehicle package." });
  }
};

const deleteVehiclePackageNew = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = firestore.collection("vehicle_packages_new").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vehicle package not found." });
    }

    await docRef.delete();
    return res.status(200).json({ message: "Vehicle package deleted successfully." });
  } catch (error) {
    console.error("Error deleting vehicle package:", error);
    return res.status(500).json({ error: "Failed to delete vehicle package." });
  }
};



module.exports = {
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
};
