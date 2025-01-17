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

    const docRef = await firestore.collection("vehicle_packages").add(newPackage);
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

// Read (Get) all vehicle packages
const getAllVehiclePackages = async (req, res) => {
  try {
    const snapshot = await firestore.collection("vehicle_packages").get();
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
    const docRef = firestore.collection("vehicle_packages").doc(id);
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

    const docRef = firestore.collection("vehicle_packages").doc(id);
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
    const docRef = firestore.collection("vehicle_packages").doc(id);
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
      .collection("vehicle_packages")
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




module.exports = {
  addVehiclePackage,
  getAllVehiclePackages,
  getVehiclePackageById,
  updateVehiclePackage,
  deleteVehiclePackage,
  getVehiclePackageByVehicleType
};
