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