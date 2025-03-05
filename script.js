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
const map = L.map('map').setView([40.7128, -74.0060], 10);
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/streets-v11',
    accessToken: 'pk.eyJ1IjoianN0ZXJ5b3VzIiwiYSI6ImNtN3QxZHY5YTAxYzYycm9sOHFsMzQwb3EifQ.kNHEp3xwmXZ5ObQlZybW9A'
}).addTo(map);

const markers = {}; // Store markers by Firebase doc ID
let userLocation = [40.7128, -74.0060]; // Default NYC, updated later

// Geocode Address with Validation
async function geocodeAddress(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=pk.eyJ1IjoianN0ZXJ5b3VzIiwiYSI6ImNtN3QxZHY5YTAxYzYycm9sOHFsMzQwb3EifQ.kNHEp3xwmXZ5ObQlZybW9A&limit=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { lat, lng, validatedAddress: data.features[0].place_name };
        }
        throw new Error("Address not found");
    } catch (error) {
        console.error("Geocoding error:", error);
        alert("Couldn’t validate that address. Please try a more specific one.");
        return null;
    }
}

// Haversine Distance (in miles)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Load Properties and Update Sidebar
function loadProperties() {
    db.collection("properties").onSnapshot((snapshot) => {
        const propertyList = document.getElementById('property-list');
        propertyList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const distance = getDistance(userLocation[0], userLocation[1], data.lat, data.lng);
            if (distance <= 30) {
                // Sidebar Item
                const li = document.createElement('li');
                li.className = 'property-item';
                li.innerHTML = `${data.address} - $${data.askingPrice}${data.salePrice ? ` (Sold: $${data.salePrice})` : ''}`;
                li.onclick = () => {
                    map.panTo([data.lat, data.lng]);
                    editProperty(doc.id, data);
                };
                propertyList.appendChild(li);

                // Marker Styling
                if (markers[doc.id]) markers[doc.id].remove();
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${data.salePrice ? 'yellow' : 'red'}; color: black; padding: 5px; border-radius: 3px; text-align: center;">$${data.salePrice || data.askingPrice}</div>`,
                    iconSize: [60, 20]
                });
                markers[doc.id] = L.marker([data.lat, data.lng], { icon })
                    .addTo(map)
                    .bindPopup(`Address: ${data.address}<br>Asking: $${data.askingPrice}<br>Sale: $${data.salePrice || 'N/A'}`);
            }
        });
    });
}

// Add or Update Property
async function addOrUpdateProperty() {
    const address = document.getElementById('address').value;
    const askingPrice = parseInt(document.getElementById('askingPrice').value);
    const salePrice = parseInt(document.getElementById('salePrice').value) || null;
    const editId = document.getElementById('edit-id').value;

    if (!address || !askingPrice) {
        alert("Please fill in Address and Asking Price!");
        return;
    }

    const coords = await geocodeAddress(address);
    if (!coords) return;

    const propertyData = {
        address: coords.validatedAddress,
        lat: coords.lat,
        lng: coords.lng,
        askingPrice: askingPrice,
        salePrice: salePrice
    };

    if (editId) {
        db.collection("properties").doc(editId).update(propertyData)
            .then(() => showFeedback("Property updated!"))
            .catch((error) => console.error("Error updating property:", error));
    } else {
        db.collection("properties").add(propertyData)
            .then(() => showFeedback("Property added!"))
            .catch((error) => console.error("Error adding property:", error));
    }
    clearForm();
}

// Edit Property
function editProperty(id, data) {
    document.getElementById('form-title').textContent = "Edit Property";
    document.getElementById('address').value = data.address;
    document.getElementById('askingPrice').value = data.askingPrice;
    document.getElementById('salePrice').value = data.salePrice || '';
    document.getElementById('edit-id').value = id;
    document.getElementById('delete-btn').style.display = 'inline';
}

// Delete Property
function deleteProperty() {
    const editId = document.getElementById('edit-id').value;
    if (editId && confirm("Delete this property?")) {
        db.collection("properties").doc(editId).delete()
            .then(() => showFeedback("Property deleted!"))
            .catch((error) => console.error("Error deleting property:", error));
        clearForm();
    }
}

// Clear Form
function clearForm() {
    document.getElementById('form-title').textContent = "Add Property";
    document.getElementById('address').value = '';
    document.getElementById('askingPrice').value = '';
    document.getElementById('salePrice').value = '';
    document.getElementById('edit-id').value = '';
    document.getElementById('delete-btn').style.display = 'none';
}

// Show Feedback
function showFeedback(message) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.style.display = 'block';
    setTimeout(() => feedback.style.display = 'none', 2000);
}

// Get User Location (for 30mi radius)
navigator.geolocation.getCurrentPosition(
    (position) => {
        userLocation = [position.coords.latitude, position.coords.longitude];
        map.setView(userLocation, 10);
        loadProperties();
    },
    () => {
        loadProperties(); // Fallback to NYC if geolocation fails
    }
);