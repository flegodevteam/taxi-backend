const admin = require("firebase-admin");

// Realtime Database instance
const realtimeDb = admin.database();

module.exports = realtimeDb;
