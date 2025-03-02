const admin = require("firebase-admin");
// const credentials = require("../key.json");
require("dotenv").config();

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Ensure newlines are handled correctly
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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
