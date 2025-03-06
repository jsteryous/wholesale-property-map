// Initialize Firebase using config from config.js
firebase.initializeApp(window.firebaseConfig);
const db = firebase.firestore();

// Initialize Leaflet Map
const map = L.map('map').setView([40.7128, -74.0060], 10);
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/streets-v11',
    accessToken: window.mapboxAccessToken // Use the global variable
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
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${window.mapboxAccessToken}&limit=1`;
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

// Load Properties (your provided function)
function loadProperties() {
    db.collection("properties").onSnapshot((snapshot) => {
        console.log(`Fetched ${snapshot.size} properties from Firestore`);
        snapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Processing property:', data);
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
                shouldDisplayType = true;
            }

            if (distance <= 30 && shouldDisplayStatus && shouldDisplayType) {
                // Marker
                if (markers[doc.id]) markers[doc.id].remove();
                const markerClass = data.sold ? 'sold' : data.offMarket ? 'off-market' : '';
                const icon = L.divIcon({
                    className: `custom-marker ${markerClass}`,
                    html: `<div>${formatPrice(data.price)}</div>`,
                    iconSize: [40, 40]
                });
                markers[doc.id] = L.marker([data.lat, data.lng], { icon })
                    .addTo(map)
                    .on('click', () => {
                        map.setView([data.lat, data.lng], 15); // Zoom in on click
                    })
                    .bindPopup(`
                        <b>Owner:</b> ${data.ownerName || 'N/A'}<br>
                        <b>Address:</b> ${data.address || 'N/A'}<br>
                        <b>County:</b> ${data.county || 'N/A'}<br>
                        <b>Parcel ID:</b> ${data.parcelId || 'N/A'}<br>
                        <b>Type:</b> ${data.propertyType || 'N/A'}<br>
                        <b>Asking Price:</b> ${formatPrice(data.price)}<br>
                        ${data.purchasePrice ? `<b>Purchase Price:</b> ${formatPrice(data.purchasePrice)}<br>` : ''}
                        ${data.purchasePrice ? `<b>Savings:</b> ${formatPrice(data.price - data.purchasePrice)}<br>` : ''}
                        <b>Status:</b> ${data.sold ? 'Sold' : data.offMarket ? 'Off Market' : 'For Sale'}<br>
                        <button class="popup-btn edit" onclick="editProperty('${doc.id}')">Edit</button>
                        <button class="popup-btn delete" onclick="deleteProperty('${doc.id}')">Delete</button>
                    `);
                console.log(`Added marker for ${data.address} at [${data.lat}, ${data.lng}]`);
            } else {
                if (markers[doc.id]) {
                    markers[doc.id].remove();
                    delete markers[doc.id];
                    console.log(`Removed marker for ${data.address} due to filter or distance`);
                }
            }
        });
    }, (error) => {
        console.error('Error in snapshot:', error);
    });
}

// Search Properties (Map-style search)
async function searchProperties() {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    const coords = await geocodeAddress(query);
    if (!coords) return;

    map.setView([coords.lat, coords.lng], 15);

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
    const ownerName = document.getElementById('owner-name').value;
    const address = document.getElementById('property-address').value;
    const county = document.getElementById('county').value;
    const parcelId = document.getElementById('parcel-id').value;
    const propertyType = document.getElementById('property-type').value;
    const priceInput = document.getElementById('price').value;
    const price = priceInput ? parseInt(priceInput) : null;
    const purchasePriceInput = document.getElementById('purchase-price').value;
    const purchasePrice = purchasePriceInput ? parseInt(purchasePriceInput) : null;
    const status = document.getElementById('property-status').value;

    if (!address || !price) {
        alert("Please fill in Address and Price!");
        return;
    }

    const isEdit = document.getElementById('add-modal').dataset.isEdit === 'true';
    const editId = document.getElementById('add-modal').dataset.editId;

    let coords;
    if (isEdit || !document.getElementById('add-modal').dataset.lat) {
        coords = await geocodeAddress(address);
        if (!coords) return;
    } else {
        coords = {
            lat: parseFloat(document.getElementById('add-modal').dataset.lat),
            lng: parseFloat(document.getElementById('add-modal').dataset.lng),
            validatedAddress: address
        };
    }

    const propertyData = {
        ownerName: ownerName || null,
        address: coords.validatedAddress,
        county: county || null,
        parcelId: parcelId || null,
        propertyType: propertyType || null,
        price: price,
        purchasePrice: purchasePrice,
        lat: coords.lat,
        lng: coords.lng,
        sold: status === 'sold',
        offMarket: status === 'offMarket'
    };

    if (isEdit) {
        db.collection("properties").doc(editId).update(propertyData)
            .then(() => {
                showFeedback("Property updated!");
                closeAddModal();
            })
            .catch((error) => {
                console.error("Error updating property:", error);
                alert("Failed to update property.");
            });
    } else {
        db.collection("properties").add(propertyData)
            .then(() => {
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
    db.collection("properties").doc(id).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('owner-name').value = data.ownerName || '';
            document.getElementById('property-address').value = data.address || '';
            document.getElementById('county').value = data.county || '';
            document.getElementById('parcel-id').value = data.parcelId || '';
            document.getElementById('property-type').value = data.propertyType || '';
            document.getElementById('price').value = data.price;
            document.getElementById('purchase-price').value = data.purchasePrice || '';
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
    if (confirm("Delete this property?")) {
        db.collection("properties").doc(id).delete()
            .then(() => showFeedback("Property deleted!"))
            .catch((error) => console.error("Error deleting property:", error));
    }
}

// Modal Controls
function openAddModal() {
    document.getElementById('add-modal').style.display = 'block';
    const modalContent = document.querySelector('.modal-content');
    modalContent.removeEventListener('click', modalClickHandler);
    modalContent.addEventListener('click', modalClickHandler);
}

function modalClickHandler(event) {
    const target = event.target;
    if (target.id === 'save-property-btn') {
        event.stopPropagation();
        addProperty();
    } else if (target.id === 'cancel-modal-btn') {
        event.stopPropagation();
        closeAddModal();
    }
}

function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('owner-name').value = '';
    document.getElementById('property-address').value = '';
    document.getElementById('county').value = '';
    document.getElementById('parcel-id').value = '';
    document.getElementById('property-type').value = '';
    document.getElementById('price').value = '';
    document.getElementById('purchase-price').value = '';
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