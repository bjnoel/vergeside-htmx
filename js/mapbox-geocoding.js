// Mapbox Geocoding Service

class MapboxGeocoding {
    constructor() {
        this.token = window.CONFIG && CONFIG.MAPBOX_TOKEN ? CONFIG.MAPBOX_TOKEN : 
                    window.ENV && ENV.MAPBOX_TOKEN ? ENV.MAPBOX_TOKEN : '';
        
        if (!this.token) {
            console.warn('MapboxGeocoding: No Mapbox token provided');
        }
    }

    /**
     * Geocode an address to get coordinates
     * @param {string} address - The address to geocode
     * @returns {Promise<object|null>} - The geocoding result or null if not found
     */
    async geocodeAddress(address) {
        if (!this.token) {
            console.error('MapboxGeocoding: Token is required for geocoding');
            return null;
        }
        
        try {
            const query = encodeURIComponent(address);
            // Add country and region parameters to focus results on Australia/Perth
            const params = new URLSearchParams({
                access_token: this.token,
                country: 'au',
                region: 'western australia',
                limit: 1
            });
            
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?${params}`);
            
            if (!response.ok) {
                throw new Error(`Geocoding API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.features && data.features.length > 0) {
                const feature = data.features[0];
                return {
                    lat: feature.center[1],
                    lng: feature.center[0],
                    location: feature.place_name,
                    bbox: feature.bbox, // Bounding box if available
                    details: feature
                };
            }
            
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    }

    /**
     * Reverse geocode coordinates to get address
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<object|null>} - The reverse geocoding result or null if not found
     */
    async reverseGeocode(lat, lng) {
        if (!this.token) {
            console.error('MapboxGeocoding: Token is required for reverse geocoding');
            return null;
        }
        
        try {
            const params = new URLSearchParams({
                access_token: this.token,
                types: 'address,neighborhood,locality,place',
                limit: 1
            });
            
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`);
            
            if (!response.ok) {
                throw new Error(`Reverse geocoding API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.features && data.features.length > 0) {
                const feature = data.features[0];
                
                // Extract address components
                const components = {};
                
                if (feature.context) {
                    feature.context.forEach(ctx => {
                        const id = ctx.id.split('.')[0];
                        components[id] = ctx.text;
                    });
                }
                
                return {
                    address: feature.place_name,
                    coordinates: {
                        lat: lat,
                        lng: lng
                    },
                    components: components,
                    details: feature
                };
            }
            
            return null;
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return null;
        }
    }

    /**
     * Get address suggestions as the user types
     * @param {string} query - The partial address query
     * @param {number} limit - Maximum number of suggestions to return
     * @returns {Promise<Array|null>} - Array of suggestions or null if error
     */
    async getSuggestions(query, limit = 5) {
        if (!this.token || !query) {
            return null;
        }
        
        try {
            const params = new URLSearchParams({
                access_token: this.token,
                country: 'au',
                region: 'western australia',
                types: 'address,place',
                autocomplete: true,
                limit: limit
            });
            
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`);
            
            if (!response.ok) {
                throw new Error(`Geocoding API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.features) {
                return data.features.map(feature => ({
                    text: feature.place_name,
                    center: feature.center,
                    data: feature
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Suggestions error:', error);
            return null;
        }
    }
}

// Create a singleton instance
const mapboxGeocoding = new MapboxGeocoding();
