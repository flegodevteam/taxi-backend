const admin = require("firebase-admin");

const createEmergencyEntry = async (req, res) => {
  try {
    const { rideId, userId, userLocation } = req.body; // Get data from request body

    // Validate required fields
    if (!rideId || !userId || !userLocation || !userLocation.longitude || !userLocation.latitude) {
      return res.status(400).json({ message: "rideId, userId, and userLocation (longitude, latitude) are required." });
    }

    // Define the emergency data
    const emergencyData = {
      rideId,
      userId,
      userLocation: {
        longitude: userLocation.longitude,
        latitude: userLocation.latitude,
      },
      status: "emergency",
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Timestamp for when the document was created
    };

    // Add the document to the 'emergency' collection
    const docRef = await admin.firestore().collection("emergency").add(emergencyData);

    return res.status(201).json({
      message: "Emergency entry created successfully.",
      emergencyId: docRef.id, // Return the document ID for reference
    });
  } catch (error) {
    console.error("Error creating emergency entry:", error);
    return res.status(500).json({ message: "An error occurred while creating the emergency entry.", error });
  }
};

const getAllEmergencyEntries = async (req, res) => {
    try {
      // Reference to the 'emergency' collection
      const emergencyRef = admin.firestore().collection("emergency");
  
      // Get all documents from the collection
      const snapshot = await emergencyRef.get();
  
      if (snapshot.empty) {
        return res.status(404).json({ message: "No emergency entries found." });
      }
  
      // Extract data from each document
      const emergencyEntries = [];
      snapshot.forEach((doc) => {
        emergencyEntries.push({
          id: doc.id, // Include document ID
          ...doc.data(), // Include document data
        });
      });
  
      return res.status(200).json({
        message: "Emergency entries retrieved successfully.",
        data: emergencyEntries,
      });
    } catch (error) {
      console.error("Error retrieving emergency entries:", error);
      return res.status(500).json({ message: "An error occurred while retrieving emergency entries.", error });
    }
  };
  

module.exports = { createEmergencyEntry,getAllEmergencyEntries };
