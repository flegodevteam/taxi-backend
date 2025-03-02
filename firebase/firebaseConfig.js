const admin = require("firebase-admin");
const credentials = require("../key.json");
require("dotenv").config();

// Initialize Firebase Admin SDK with your credentials
admin.initializeApp({
  credential: admin.credential.cert(credentials),
  databaseURL: "https://taxia-cca4b-default-rtdb.firebaseio.com"
});

// Firestore reference
const firestore = admin.firestore();

// Realtime Database reference
const realtimeDb = admin.database();

// Firebase Cloud Messaging reference
const messaging = admin.messaging();  // This initializes FCM

// Export firestore, realtimeDb, and messaging
module.exports = { firestore, realtimeDb, messaging };
