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
let currentStatusFilter = 'all';
let currentTypeFilter = 'all';
let tempMarker = null;

// Format Price to "K"
function formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) return '$0';
    return price >= 1000 ? `$${(price / 1000).toFixed(0)}K` : `$${price}`;
}

// Geocode Address
async function geocodeAddress(address) {
    console.log("Geocoding address:", address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=pk.eyJ1IjoianN0ZXJ5b3VzIiwiYSI6ImNtN3QxZHY5YTAxYzYycm9sOHFsMzQwb3EifQ.kNHEp3xwmXZ5ObQlZybW9A&limit=1`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            console.log("Geocoded successfully:", { lat, lng, validatedAddress: data.features[0].place_name });
            return { lat, lng, validatedAddress: data.features[0].place_name };
        }
        throw new Error("Address not found");
    } catch (error) {
        console.error("Geocoding error:", error);
        alert("Couldn’t find that address. Please try again.");
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

            // Apply status filter
            let shouldDisplayStatus = false;
            if (currentStatusFilter === 'all') {
                shouldDisplayStatus = true;
            } else if (currentStatusFilter === 'sold' && data.sold) {
                shouldDisplayStatus = true;
            } else if (currentStatusFilter === 'forSale' && !data.sold && !data.offMarket) {
                shouldDisplayStatus = true;
            } else if (currentStatusFilter === 'offMarket' && data.offMarket) {
                shouldDisplayStatus = true;
            }

            // Apply type filter
            let shouldDisplayType = false;
            if (currentTypeFilter === 'all') {
                shouldDisplayType = true;
            } else if (data.propertyType === currentTypeFilter) {
                shouldDisplayType = true;
            } else if (!data.propertyType && currentTypeFilter === 'House') {
                // Handle legacy properties (e.g., "Residential" or undefined)
                shouldDisplayType = true;
            }

            if (distance <= 30 && shouldDisplayStatus && shouldDisplayType) {
                // Sidebar Item
                const li = document.createElement('li');
                li.className = 'property-item';
                li.innerHTML = `${data.address || 'N/A'}<br><small>${data.ownerName || 'Unknown Owner'} - ${formatPrice(data.price)}</small>`;
                li.onclick = () => map.panTo([data.lat, data.lng]);
                propertyList.appendChild(li);

                // Marker
                if (markers[doc.id]) markers[doc.id].remove();
                const markerClass = data.sold ? 'sold' : data.offMarket ? 'off-market' : '';
                const icon = L.divIcon({
                    className: `custom-marker ${markerClass}`,
                    html: `<div>${formatPrice(data.price)}</div>`,
                    iconSize: [80, 24]
                });
                markers[doc.id] = L.marker([data.lat, data.lng], { icon })
                    .addTo(map)
                    .bindPopup(`
                        <b>Owner:</b> ${data.ownerName || 'N/A'}<br>
                        <b>Address:</b> ${data.address || 'N/A'}<br>
                        <b>County:</b> ${data.county || 'N/A'}<br>
                        <b>Parcel ID:</b> ${data.parcelId || 'N/A'}<br>
                        <b>Type:</b> ${data.propertyType || 'N/A'}<br>
                        <b>Price:</b> ${formatPrice(data.price)}<br>
                        <b>Status:</b> ${data.sold ? 'Sold' : data.offMarket ? 'Off Market' : 'For Sale'}<br>
                        <button class="popup-btn edit" onclick="editProperty('${doc.id}')">Edit</button>
                        <button class="popup-btn delete" onclick="deleteProperty('${doc.id}')">Delete</button>
                    `);
            } else {
                if (markers[doc.id]) {
                    markers[doc.id].remove();
                    delete markers[doc.id];
                }
            }
        });
    });
}

// Search Properties (Map-style search)
async function searchProperties() {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    // Remove temporary marker if it exists
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    // Geocode the search query
    const coords = await geocodeAddress(query);
    if (!coords) return;

    // Zoom in to the location
    map.setView([coords.lat, coords.lng], 15);

    // Check if the address matches any property in the database
    let foundProperty = false;
    const snapshot = await db.collection("properties").get();
    snapshot.forEach((doc) => {
        const data = doc.data();
        const addressMatch = data.address && typeof data.address === 'string' && data.address.toLowerCase().includes(query.toLowerCase());
        const ownerMatch = data.ownerName && typeof data.ownerName === 'string' && data.ownerName.toLowerCase().includes(query.toLowerCase());
        if (addressMatch || ownerMatch) {
            foundProperty = true;
            map.setView([data.lat, data.lng], 15);
            markers[doc.id].openPopup();
        }
    });

    // If no match in database, show the location on the map
    if (!foundProperty) {
        tempMarker = L.marker([coords.lat, coords.lng])
            .addTo(map)
            .bindPopup(`
                <b>Address:</b> ${coords.validatedAddress}<br>
                <button class="popup-btn edit" onclick="addPropertyAtLocation('${coords.validatedAddress}', ${coords.lat}, ${coords.lng})">Add Property Here</button>
            `)
            .openPopup();
    }
}

// Add Property at Searched Location
function addPropertyAtLocation(address, lat, lng) {
    console.log("addPropertyAtLocation called:", { address, lat, lng });
    document.getElementById('property-address').value = address;
    document.getElementById('add-modal').dataset.lat = lat;
    document.getElementById('add-modal').dataset.lng = lng;
    document.getElementById('add-modal').dataset.isEdit = 'false';
    document.querySelector('#add-modal h2').textContent = 'Add Property';
    document.querySelector('#add-modal button#save-property-btn').textContent = 'Save';
    document.getElementById('property-status').value = 'forSale';
    document.getElementById('property-type').value = '';
    openAddModal();
}

// Filter Properties
function filterProperties() {
    currentStatusFilter = document.getElementById('filter-status-dropdown').value;
    currentTypeFilter = document.getElementById('filter-type-dropdown').value;
    loadProperties();
}

// Add Property
async function addProperty() {
    console.log("addProperty called");
    const ownerName = document.getElementById('owner-name').value;
    const address = document.getElementById('property-address').value;
    const county = document.getElementById('county').value;
    const parcelId = document.getElementById('parcel-id').value;
    const propertyType = document.getElementById('property-type').value;
    const priceInput = document.getElementById('price').value;
    const price = priceInput ? parseInt(priceInput) : null;
    const status = document.getElementById('property-status').value;

    console.log("Form data:", { ownerName, address, county, parcelId, propertyType, price, status });

    if (!address || !price) {
        console.log("Validation failed: Address or Price missing");
        alert("Please fill in Address and Price!");
        return;
    }

    const isEdit = document.getElementById('add-modal').dataset.isEdit === 'true';
    const editId = document.getElementById('add-modal').dataset.editId;

    let coords;
    if (isEdit || !document.getElementById('add-modal').dataset.lat) {
        coords = await geocodeAddress(address);
        if (!coords) {
            console.log("Geocoding failed");
            return;
        }
    } else {
        // Use pre-geocoded coords from search
        coords = {
            lat: parseFloat(document.getElementById('add-modal').dataset.lat),
            lng: parseFloat(document.getElementById('add-modal').dataset.lng),
            validatedAddress: address
        };
    }

    console.log("Geocoded coords:", coords);

    const propertyData = {
        ownerName: ownerName || null,
        address: coords.validatedAddress,
        county: county || null,
        parcelId: parcelId || null,
        propertyType: propertyType || null,
        price: price,
        lat: coords.lat,
        lng: coords.lng,
        sold: status === 'sold',
        offMarket: status === 'offMarket'
    };

    console.log("Property data to save:", propertyData);

    if (isEdit) {
        console.log("Updating property with ID:", editId);
        db.collection("properties").doc(editId).update(propertyData)
            .then(() => {
                console.log("Property updated successfully");
                showFeedback("Property updated!");
                closeAddModal();
            })
            .catch((error) => {
                console.error("Error updating property:", error);
                alert("Failed to update property.");
            });
    } else {
        console.log("Adding new property");
        db.collection("properties").add(propertyData)
            .then(() => {
                console.log("Property added successfully");
                showFeedback("Property added!");
                closeAddModal();
                if (tempMarker) {
                    map.removeLayer(tempMarker);
                    tempMarker = null;
                }
            })
            .catch((error) => {
                console.error("Error adding property:", error);
                alert("Failed to add property.");
            });
    }
}

// Edit Property
function editProperty(id) {
    console.log("editProperty called with ID:", id);
    db.collection("properties").doc(id).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('owner-name').value = data.ownerName || '';
            document.getElementById('property-address').value = data.address || '';
            document.getElementById('county').value = data.county || '';
            document.getElementById('parcel-id').value = data.parcelId || '';
            document.getElementById('property-type').value = data.propertyType || '';
            document.getElementById('price').value = data.price;
            document.getElementById('property-status').value = data.sold ? 'sold' : data.offMarket ? 'offMarket' : 'forSale';
            document.getElementById('add-modal').dataset.editId = id;
            document.getElementById('add-modal').dataset.isEdit = 'true';
            document.getElementById('add-modal').dataset.lat = '';
            document.getElementById('add-modal').dataset.lng = '';
            document.querySelector('#add-modal h2').textContent = 'Edit Property';
            document.querySelector('#add-modal button#save-property-btn').textContent = 'Update';
            openAddModal();
        }
    }).catch((error) => {
        console.error("Error fetching property for edit:", error);
    });
}

// Delete Property
function deleteProperty(id) {
    console.log("deleteProperty called with ID:", id);
    if (confirm("Delete this property?")) {
        db.collection("properties").doc(id).delete()
            .then(() => showFeedback("Property deleted!"))
            .catch((error) => console.error("Error deleting property:", error));
    }
}

// Modal Controls
function openAddModal() {
    console.log("openAddModal called");
    document.getElementById('add-modal').style.display = 'block';

    // Attach event listeners using delegation on modal-content
    const modalContent = document.querySelector('.modal-content');
    modalContent.removeEventListener('click', modalClickHandler);
    modalContent.addEventListener('click', modalClickHandler);
}

function modalClickHandler(event) {
    const target = event.target;
    console.log("Modal click event:", target.id);
    if (target.id === 'save-property-btn') {
        console.log("Save button clicked via delegation");
        event.stopPropagation();
        addProperty();
    } else if (target.id === 'cancel-modal-btn') {
        console.log("Cancel button clicked via delegation");
        event.stopPropagation();
        closeAddModal();
    }
}

function closeAddModal() {
    console.log("closeAddModal called");
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('owner-name').value = '';
    document.getElementById('property-address').value = '';
    document.getElementById('county').value = '';
    document.getElementById('parcel-id').value = '';
    document.getElementById('property-type').value = '';
    document.getElementById('price').value = '';
    document.getElementById('property-status').value = 'forSale';
    document.getElementById('add-modal').dataset.editId = '';
    document.getElementById('add-modal').dataset.isEdit = 'false';
    document.getElementById('add-modal').dataset.lat = '';
    document.getElementById('add-modal').dataset.lng = '';
    document.querySelector('#add-modal h2').textContent = 'Add Property';
    document.querySelector('#add-modal button#save-property-btn').textContent = 'Save';
}

// Show Feedback
function showFeedback(message) {
    console.log("showFeedback called with message:", message);
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.style.display = 'block';
    setTimeout(() => feedback.style.display = 'none', 2000);
}

// Debug Modal Overlay Clicks
document.getElementById('add-modal').addEventListener('click', (event) => {
    console.log("Modal overlay clicked at:", event.target.className);
});

// Get User Location
navigator.geolocation.getCurrentPosition(
    (position) => {
        userLocation = [position.coords.latitude, position.coords.longitude];
        map.setView(userLocation, 10);
        loadProperties();
    },
    () => loadProperties()
);