const admin = require('firebase-admin');

const createComplain = async (req, res) => {
    const { userName,userId, phoneNumber, time, date, description, title } = req.body;
    
    if (!userId || !phoneNumber || !time || !date || !description || !title) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    
    try {
        const newComplain = {
            userName,
            userId,
            phoneNumber,
            time,
            date,
            description,
            title,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        const docRef = await admin.firestore().collection('complains').add(newComplain);
        return res.status(201).json({ message: "Complain created successfully.", id: docRef.id });
    } catch (error) {
        console.error("Error creating complain:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const getAllComplains = async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection('complains').get();
        const complains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ complains });
    } catch (error) {
        console.error("Error fetching complains:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const getComplainById = async (req, res) => {
    const { id } = req.params;
    
    try {
        const doc = await admin.firestore().collection('complains').doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Complain not found." });
        }
        return res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error("Error fetching complain by ID:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const getComplainByPhoneNumber = async (req, res) => {
    const { phoneNumber } = req.params;
    
    if (!phoneNumber) {
        return res.status(400).json({ error: "Missing phone number parameter." });
    }
    
    try {
        const snapshot = await admin.firestore().collection('complains').where('phoneNumber', '==', phoneNumber).get();
        if (snapshot.empty) {
            return res.status(404).json({ message: "No complaints found for the given phone number." });
        }
        const complains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ complains });
    } catch (error) {
        console.error("Error fetching complains by phone number:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const updateComplain = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    try {
        await admin.firestore().collection('complains').doc(id).update(updates);
        return res.status(200).json({ message: "Complain updated successfully." });
    } catch (error) {
        console.error("Error updating complain:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const deleteComplain = async (req, res) => {
    const { id } = req.params;
    
    try {
        await admin.firestore().collection('complains').doc(id).delete();
        return res.status(200).json({ message: "Complain deleted successfully." });
    } catch (error) {
        console.error("Error deleting complain:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

module.exports = {
    createComplain,
    getAllComplains,
    getComplainById,
    getComplainByPhoneNumber,
    updateComplain,
    deleteComplain
};
