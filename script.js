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

const markers = {};
let userLocation = [40.7128, -74.0060];

// Format Price to "K"
function formatPrice(price) {
    return price >= 1000 ? `$${(price / 1000).toFixed(0)}K` : `$${price}`;
}

// Geocode Address
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
        alert("Couldn’t find that address.");
        return null;
    }
}

// Haversine Distance (in miles)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Load Properties
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
                li.innerHTML = `${data.address}<br><small>${data.ownerName || 'Unknown Owner'} - ${formatPrice(data.price)}</small>`;
                li.onclick = () => map.panTo([data.lat, data.lng]);
                propertyList.appendChild(li);

                // Marker
                if (markers[doc.id]) markers[doc.id].remove();
                const icon = L.divIcon({
                    className: `custom-marker ${data.sold ? 'sold' : ''}`,
                    html: `<div>${formatPrice(data.price)}</div>`,
                    iconSize: [80, 24]
                });
                markers[doc.id] = L.marker([data.lat, data.lng], { icon })
                    .addTo(map)
                    .bindPopup(`Owner: ${data.ownerName || 'N/A'}<br>Address: ${data.address}<br>County: ${data.county || 'N/A'}<br>Parcel ID: ${data.parcelId || 'N/A'}<br>Type: ${data.propertyType || 'N/A'}<br>Price: ${formatPrice(data.price)}`);
            }
        });
    });
}

// Search Properties
function searchProperties() {
    const query = document.getElementById('search-input').value.toLowerCase();
    db.collection("properties").get().then((snapshot) => {
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.address.toLowerCase().includes(query) || (data.ownerName && data.ownerName.toLowerCase().includes(query))) {
                map.panTo([data.lat, data.lng]);
                markers[doc.id].openPopup();
            }
        });
    });
}

// Add Property
async function addProperty() {
    const ownerName = document.getElementById('owner-name').value;
    const address = document.getElementById('property-address').value;
    const county = document.getElementById('county').value;
    const parcelId = document.getElementById('parcel-id').value;
    const propertyType = document.getElementById('property-type').value;
    const price = parseInt(document.getElementById('price').value);

    if (!address || !price) {
        alert("Please fill in Address and Price!");
        return;
    }

    const coords = await geocodeAddress(address);
    if (!coords) return;

    db.collection("properties").add({
        ownerName: ownerName || null,
        address: coords.validatedAddress,
        county: county || null,
        parcelId: parcelId || null,
        propertyType: propertyType || null,
        price: price,
        lat: coords.lat,
        lng: coords.lng,
        sold: false
    }).then(() => {
        showFeedback("Property added!");
        closeAddModal();
    }).catch((error) => console.error("Error adding property:", error));
}

// Modal Controls
function openAddModal() {
    document.getElementById('add-modal').style.display = 'block';
}
function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('owner-name').value = '';
    document.getElementById('property-address').value = '';
    document.getElementById('county').value = '';
    document.getElementById('parcel-id').value = '';
    document.getElementById('property-type').value = '';
    document.getElementById('price').value = '';
}

// Show Feedback
function showFeedback(message) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.style.display = 'block';
    setTimeout(() => feedback.style.display = 'none', 2000);
}

// Get User Location
navigator.geolocation.getCurrentPosition(
    (position) => {
        userLocation = [position.coords.latitude, position.coords.longitude];
        map.setView(userLocation, 10);
        loadProperties();
    },
    () => loadProperties()
);