const express = require('express');
const router = express.Router();
const { registerAdmin,loginAdmin } = require('../controllers/AdminController');
const {authenticateToken} = require("../Middleware/Auth")


//reg
router.post('/registerAdmin', registerAdmin);

router.post('/admin-Login-by-email', loginAdmin);


module.exports = router;
