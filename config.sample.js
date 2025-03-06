// config.sample.js
// Rename to config.js and fill in your own API keys from your .env file
const firebaseConfig = {
    apiKey: "your-firebase-api-key-here",
    authDomain: "your-firebase-auth-domain-here",
    projectId: "your-firebase-project-id-here",
    storageBucket: "your-firebase-storage-bucket-here",
    messagingSenderId: "your-firebase-messaging-sender-id-here",
    appId: "your-firebase-app-id-here",
    measurementId: "your-firebase-measurement-id-here"
};

const mapboxAccessToken = "your-mapbox-access-token-here";

window.firebaseConfig = firebaseConfig;
window.mapboxAccessToken = mapboxAccessToken;