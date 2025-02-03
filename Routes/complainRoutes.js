const express = require('express');
const router = express.Router();
const {
    createComplain,
    getAllComplains,
    getComplainById,
    updateComplain,
    deleteComplain,
    getComplainByPhoneNumber
} = require('../controllers/complainController');

// Create a new complain
router.post('/create-complain', createComplain);

// Get all complains
router.get('/get-all-complains', getAllComplains);

// Get a single complain by ID
router.get('/get-complain/:id', getComplainById);

// Update a complain by ID
router.put('/update-complains/:id', updateComplain);

// Delete a complain by ID
router.delete('/delete-complains/:id', deleteComplain);

// Get a single complain by ID
router.get('/get-complain-by-phone/:phoneNumber', getComplainByPhoneNumber);

module.exports = router;
