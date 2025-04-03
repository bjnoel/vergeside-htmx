// Mapbox controller for map integration

// Default configuration values
const MAP_DEFAULTS = {
    MAP_DEFAULT_CENTER: { lat: -31.9505, lng: 115.8605 }, // Perth, WA as default
    MAP_DEFAULT_ZOOM: 10,
    TIMEZONE: '+08:00', // Perth timezone (GMT+8)
    DEFAULT_DATE_FORMAT: 'YYYY-MM-DD',
    DEFAULT_DATE_RANGE: {
        START_OFFSET: 0,
        END_OFFSET: 28
    },
    COLORS: {
        // Colors representing 0-7 days, 8-14 days, etc.
        WEEK_0: '#ff4000', // Red
        WEEK_1: '#ffbf00', // Orange
        WEEK_2: '#ffff00', // Yellow
        WEEK_3: '#bfff00', // Yellow-Green
        WEEK_4: '#80ff00', // Light Green
        WEEK_5: '#40ff00', // Green
        WEEK_6: '#00ff00', // Green
        WEEK_7: '#00ff40', // Green-Cyan
        WEEK_8: '#00ff80', // Light Cyan
        WEEK_9: '#00ffbf', // Cyan
        WEEK_10: '#00ffff', // Cyan
        WEEK_11: '#00bfff', // Light Blue
        WEEK_12: '#0080ff', // Light Blue
        WEEK_13: '#0040ff', // Blue
        WEEK_14: '#0000ff', // Blue
        DEFAULT: '#808080' // Gray for unknown or past dates
    }
};

// Helper function to get configuration values with fallbacks
function getMapConfig(key, fallback) {
    if (window.CONFIG && typeof CONFIG[key] !== 'undefined') {
        return CONFIG[key];
    }
    if (window.ENV && typeof ENV[key] !== 'undefined') {
        return ENV[key];
    }
    return fallback;
}

class MapController {
    constructor() {
        this.map = null;
        this.layers = [];
        this.startDate = null;
        this.endDate = null;
        this.loadingDiv = null;
        this.debugMode = false;
        this.mapboxToken = getMapConfig('MAPBOX_TOKEN', '');
    }

    // Debug log
    debug(message, data = null) {
        if (this.debugMode) {
            if (data) {
                console.log(`[MapController] ${message}`, data);
            } else {
                console.log(`[MapController] ${message}`);
            }
        }
    }

    // Initialize the Mapbox map
    // Returns true if successful, false otherwise
    initMap() {
        try {
            // Get token from global variable, config, or environment
            this.mapboxToken = window.MAPBOX_TOKEN || getMapConfig('MAPBOX_TOKEN', '');
            
            // Debug token to ensure it's loaded
            console.log('MapController: Token available:', !!this.mapboxToken);
            
            // Check if the token is missing or is a placeholder
            if (!this.mapboxToken || 
                this.mapboxToken === 'pk.eyJ1IjoieW91ci1hY3R1YWwtdG9rZW4iLCJhIjoieW91ci1hY3R1YWwtdG9rZW4ifQ.your-actual-token' || 
                this.mapboxToken === 'pk.abc123YourActualMapboxTokenHere') {
                console.error('MapController: Valid Mapbox token is missing');
                document.getElementById('map').innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>Map Configuration Error</h5>
                        <p>Please replace the placeholder Mapbox token with your actual token in the HTML file.</p>
                        <p><a href="https://docs.mapbox.com/help/getting-started/access-tokens/" target="_blank" class="alert-link">Learn how to get a Mapbox token</a></p>
                    </div>
                `;
                return false;
            }
            
            // Set access token for Mapbox GL
            mapboxgl.accessToken = this.mapboxToken;
            console.log('MapController: Successfully set Mapbox token');
        
            const defaultCenter = getMapConfig('MAP_DEFAULT_CENTER', MAP_DEFAULTS.MAP_DEFAULT_CENTER);
            const defaultZoom = getMapConfig('MAP_DEFAULT_ZOOM', MAP_DEFAULTS.MAP_DEFAULT_ZOOM);
            
            this.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [defaultCenter.lng, defaultCenter.lat],
                zoom: defaultZoom
            });
            
            // Add navigation controls
            this.map.addControl(new mapboxgl.NavigationControl());
            
            // Wait for map to load before adding data
            this.map.on('load', () => {
                this.debug('Map loaded');
            });
            
            console.log('MapController: Map initialized successfully');
            return true;
        } catch (error) {
            console.error('MapController: Error initializing map:', error);
            document.getElementById('map').innerHTML = `
                <div class="alert alert-danger m-3">
                    <h5>Map Initialization Error</h5>
                    <p>There was an error initializing the map: ${error.message}</p>
                </div>
            `;
            return false;
        }
    }

    // Clear existing layers and sources
    clearMap() {
        if (this.map) {
            // First remove all layers
            this.layers.forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.removeLayer(layerId);
                }
            });
            
            // Then remove sources
            const sources = this.layers.map(layerId => layerId.replace('-layer', '-source')
                                                      .replace('-outline', '-source'));
            
            // Use a Set to remove duplicate source IDs
            const uniqueSources = [...new Set(sources)];
            
            uniqueSources.forEach(sourceId => {
                if (this.map.getSource(sourceId)) {
                    this.map.removeSource(sourceId);
                }
            });
            
            // Clear the layers array
            this.layers = [];
            
            console.log('MapController: Cleared map layers and sources');
        }
    }

    // Show loading indicator
    showLoading() {
        if (!this.loadingDiv) {
            this.loadingDiv = document.createElement('div');
            this.loadingDiv.className = 'loading-overlay';
            this.loadingDiv.style.position = 'absolute';
            this.loadingDiv.style.top = '50%';
            this.loadingDiv.style.left = '50%';
            this.loadingDiv.style.transform = 'translate(-50%, -50%)';
            this.loadingDiv.style.zIndex = '1000';
            this.loadingDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
            this.loadingDiv.style.padding = '15px';
            this.loadingDiv.style.borderRadius = '5px';
            this.loadingDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2 mb-0">Loading map data...</p>';
            
            const mapContainer = document.getElementById('map').parentNode;
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(this.loadingDiv);
        } else {
            this.loadingDiv.style.display = 'block';
        }
    }

    // Hide loading indicator
    hideLoading() {
        if (this.loadingDiv) {
            this.loadingDiv.style.display = 'none';
        }
    }

    // Set the date range for filtering
    setDateRange(startDate, endDate) {
        this.startDate = startDate;
        this.endDate = endDate;
    }

    // Convert area polygon to GeoJSON
    areaToGeoJSON(area, polygons, color, pickupDate) {
        // Format the pickup date
        const pickupDateFormatted = moment(pickupDate).format('dddd, MMMM D, YYYY');
        
        // Create GeoJSON features for each polygon
        const features = [];
        
        for (const polygonData of polygons) {
            let coordinates = [];
            
            try {
                // Try to parse as JSON
                const jsonPaths = JSON.parse(polygonData.coordinates);
                coordinates = [jsonPaths.map(coord => [coord.lng, coord.lat])];
            } catch (e) {
                // If it's not valid JSON, assume it's KML format string
                coordinates = [
                    polygonData.coordinates.trim().split(' ').map(coord => {
                        const parts = coord.split(',');
                        if (parts.length >= 2) {
                            return [parseFloat(parts[0]), parseFloat(parts[1])];
                        }
                        return null;
                    }).filter(point => point !== null)
                ];
            }
            
            if (coordinates[0] && coordinates[0].length > 0) {
                features.push({
                    type: 'Feature',
                    properties: {
                        title: area.name,
                        council: area.council ? area.council.name : area.council_id,
                        nextPickup: pickupDateFormatted,
                        fillColor: color,
                        strokeColor: color
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: coordinates
                    }
                });
            }
        }
        
        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    // Load and display areas on the map
    async loadAreas(councilId = null) {
        try {
            // Check if map exists
            if (!this.map) {
                console.error('MapController: Map not initialized. Cannot load areas.');
                return false;
            }
            
            // Wait for map to load if needed
            if (!this.map.loaded()) {
                console.log('MapController: Waiting for map to load...');
                await new Promise(resolve => {
                    this.map.on('load', resolve);
                });
            }
            
            // Clear existing layers
            this.clearMap();
            
            // Set default date range if not specified
            if (!this.startDate || !this.endDate) {
                const timezone = getMapConfig('TIMEZONE', MAP_DEFAULTS.TIMEZONE);
                const dateFormat = getMapConfig('DEFAULT_DATE_FORMAT', MAP_DEFAULTS.DEFAULT_DATE_FORMAT);
                const endOffset = getMapConfig('DEFAULT_DATE_RANGE', MAP_DEFAULTS.DEFAULT_DATE_RANGE).END_OFFSET;
                
                const today = moment().utcOffset(timezone).startOf('day');
                this.startDate = today.format(dateFormat);
                this.endDate = today.clone().add(endOffset, 'days').format(dateFormat);
            }
            
            this.debug('Loading areas with date range:', { startDate: this.startDate, endDate: this.endDate, councilId });
            
            // Show loading indicator
            this.showLoading();
            
            // Get all pickups for the date range
            const pickups = await supabaseClient.getAllPickups(this.startDate, this.endDate);
            
            // Group pickups by area
            const areaPickupMap = new Map();
            pickups.forEach(pickup => {
                if (!areaPickupMap.has(pickup.area_id)) {
                    areaPickupMap.set(pickup.area_id, []);
                }
                areaPickupMap.get(pickup.area_id).push(pickup);
            });
            
            // Get areas filtered by council if specified
            const areas = await supabaseClient.getAreas(councilId);
            
            // Collect all features for the map
            const allFeatures = [];
            
            // Process each area
            for (const area of areas) {
                if (areaPickupMap.has(area.id)) {
                    const areaPickups = areaPickupMap.get(area.id);
                    if (areaPickups && areaPickups.length > 0) {
                        // Sort pickups by date
                        areaPickups.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                        const nextPickup = areaPickups[0];
                        
                        // Get polygon coordinates
                        const areaPolygons = await supabaseClient.getAreaPolygons(area.id);
                        
                        if (areaPolygons && areaPolygons.length > 0) {
                            // Get the appropriate color based on pickup date
                            const pickupDate = nextPickup.start_date;
                            const timezone = getMapConfig('TIMEZONE', MAP_DEFAULTS.TIMEZONE);
                            const today = moment().utcOffset(timezone).startOf('day');
                            const pickup = moment(pickupDate).utcOffset(timezone).startOf('day');
                            const daysUntilPickup = pickup.diff(today, 'days');
                            
                            // Determine which color to use
                            const colors = getMapConfig('COLORS', MAP_DEFAULTS.COLORS);
                            let color = colors.DEFAULT;
                            
                            if (daysUntilPickup < 0) {
                                color = colors.DEFAULT;
                            } else {
                                const weekIndex = Math.min(Math.floor(daysUntilPickup / 7), 14);
                                color = colors[`WEEK_${weekIndex}`] || colors.DEFAULT;
                            }
                            
                            // Convert area to GeoJSON
                            const areaGeoJSON = this.areaToGeoJSON(area, areaPolygons, color, pickupDate);
                            
                            // Add to all features
                            allFeatures.push(...areaGeoJSON.features);
                            
                            // Add as individual area for interaction
                            const sourceId = `area-${area.id}-source`;
                            const layerId = `area-${area.id}-layer`;
                            const outlineLayerId = `${layerId}-outline`;
                            
                            try {
                                // Check if source already exists first
                                if (!this.map.getSource(sourceId)) {
                                    this.map.addSource(sourceId, {
                                        type: 'geojson',
                                        data: areaGeoJSON
                                    });
                                }
                                
                                // Add fill layer if it doesn't exist
                                if (!this.map.getLayer(layerId)) {
                                    this.map.addLayer({
                                        id: layerId,
                                        type: 'fill',
                                        source: sourceId,
                                        paint: {
                                            'fill-color': color,
                                            'fill-opacity': 0.35
                                        }
                                    });
                                }
                                
                                // Add outline layer if it doesn't exist
                                if (!this.map.getLayer(outlineLayerId)) {
                                    this.map.addLayer({
                                        id: outlineLayerId,
                                        type: 'line',
                                        source: sourceId,
                                        paint: {
                                            'line-color': color,
                                            'line-width': 2
                                        }
                                    });
                                }
                                
                                // Keep track of added layers
                                this.layers.push(layerId, outlineLayerId);
                            } catch (error) {
                                console.error(`Error adding area ${area.id} to map:`, error.message);
                                // Continue with next area
                                continue;
                            }
                            
                            // Add click event for popup
                            // First, remove any existing handlers to prevent duplicates
                            this.map.off('click', layerId);
                            this.map.off('mouseenter', layerId);
                            this.map.off('mouseleave', layerId);
                            
                            // Then add the handlers
                            this.map.on('click', layerId, (e) => {
                                const properties = e.features[0].properties;
                                
                                new mapboxgl.Popup()
                                    .setLngLat(e.lngLat)
                                    .setHTML(`
                                        <div class="info-window">
                                            <h5>${properties.title}</h5>
                                            <p><strong>Council:</strong> ${properties.council}</p>
                                            <p><strong>Next Pickup:</strong> ${properties.nextPickup}</p>
                                        </div>
                                    `)
                                    .addTo(this.map);
                            });
                            
                            // Change cursor on hover
                            this.map.on('mouseenter', layerId, () => {
                                this.map.getCanvas().style.cursor = 'pointer';
                            });
                            
                            this.map.on('mouseleave', layerId, () => {
                                this.map.getCanvas().style.cursor = '';
                            });
                        }
                    }
                }
            }
            
            // If we have features, create a bounding box to fit the map
            if (allFeatures.length > 0) {
                const combinedFeatures = {
                    type: 'FeatureCollection',
                    features: allFeatures
                };
                
                // Calculate bounds
                const bounds = new mapboxgl.LngLatBounds();
                allFeatures.forEach(feature => {
                    if (feature.geometry && feature.geometry.coordinates) {
                        feature.geometry.coordinates[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    }
                });
                
                // Fit map to bounds
                this.map.fitBounds(bounds, { padding: 40 });
            }
            
            // Hide loading indicator
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading areas:', error);
            this.hideLoading();
            
            // Show error message
            const mapElement = document.getElementById('map');
            mapElement.innerHTML = `
                <div class="alert alert-danger m-3">
                    <h5>Error Loading Map Data</h5>
                    <p>There was a problem loading the map data. Please try again later.</p>
                </div>
            `;
        }
    }
}

// Create a singleton instance
const mapController = new MapController();

// Initialize the map when document is ready
function initMap() {
    try {
        // Initialize the map first
        const mapInitialized = mapController.initMap();
        
        // Only load areas if the map was successfully initialized
        if (mapInitialized && mapController.map) {
            mapController.loadAreas();
        } else {
            console.log('Map not initialized, skipping loadAreas');
        }
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = `
            <div class="alert alert-danger m-3">
                <h5>Map Initialization Error</h5>
                <p>There was an error initializing the map: ${error.message}</p>
                <p>Please check your Mapbox token configuration.</p>
            </div>
        `;
    }
}

// Call initMap when document is loaded
document.addEventListener('DOMContentLoaded', initMap);
