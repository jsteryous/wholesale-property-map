// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBJisaOX4oNwZRIUIUPiB6CtQYfRK95Tbg",
    authDomain: "wholesale-property-map.firebaseapp.com",
    projectId: "wholesale-property-map",
    storageBucket: "wholesale-property-map.firebasestorage.app",
    messagingSenderId: "999788212543",
    appId: "1:999788212543:web:23c3c95a460ad4cfba638a",
    measurementId: "G-278HH4MXG1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Initialize Leaflet Map
const map = L.map('map').setView([40.7128, -74.0060], 10); // Default: NYC

// Add Mapbox Tile Layer
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/streets-v11',
    accessToken: 'pk.eyJ1IjoianN0ZXJ5b3VzIiwiYSI6ImNtN3QxZHY5YTAxYzYycm9sOHFsMzQwb3EifQ.kNHEp3xwmXZ5ObQlZybW9A'
}).addTo(map);

// Load Properties from Firestore
function loadProperties() {
    db.collection("properties").get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            L.marker([data.lat, data.lng])
                .addTo(map)
                .bindPopup(`Address: ${data.address}<br>Asking: $${data.askingPrice}<br>Sale: $${data.salePrice || 'N/A'}`);
        });
    }).catch((error) => {
        console.error("Error loading properties: ", error);
    });
}

// Geocode Address to Coordinates
async function geocodeAddress(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=pk.eyJ1IjoianN0ZXJ5b3VzIiwiYSI6ImNtN3QxZHY5YTAxYzYycm9sOHFsMzQwb3EifQ.kNHEp3xwmXZ5ObQlZybW9A`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { lat, lng };
        } else {
            throw new Error("Address not found");
        }
    } catch (error) {
        console.error("Geocoding error:", error);
        alert("Couldn’t find that address. Please try again.");
        return null;
    }
}

// Add Property to Map and Firestore
async function addProperty() {
    const address = document.getElementById('address').value;
    const askingPrice = parseInt(document.getElementById('askingPrice').value);
    const salePrice = parseInt(document.getElementById('salePrice').value) || null;

    if (!address || !askingPrice) {
        alert("Please fill in Address and Asking Price!");
        return;
    }

    const coords = await geocodeAddress(address);
    if (!coords) return;

    const { lat, lng } = coords;

    // Save to Firebase
    db.collection("properties").add({
        address: address,
        lat: lat,
        lng: lng,
        askingPrice: askingPrice,
        salePrice: salePrice
    }).then(() => {
        // Add marker to map
        console.log(`Adding marker at: ${lat}, ${lng}`); // Debug log
        const marker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`Address: ${address}<br>Asking: $${askingPrice}<br>Sale: $${salePrice || 'N/A'}`);
        map.panTo([lat, lng]); // Optional: Center map on new marker
        // Clear form
        document.getElementById('address').value = '';
        document.getElementById('askingPrice').value = '';
        document.getElementById('salePrice').value = '';
    }).catch((error) => {
        console.error("Error adding property: ", error);
    });
}

// Load properties on start
loadProperties();