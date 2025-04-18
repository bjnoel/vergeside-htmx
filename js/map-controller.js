// Map controller for Google Maps integration

// Default configuration values if CONFIG is not defined
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
        this.polygons = [];
        this.startDate = null;
        this.endDate = null;
        this.loadingDiv = null;
        this.debugMode = false;
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

    // Initialize the Google Map
    initMap() {
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: getMapConfig('MAP_DEFAULT_CENTER', MAP_DEFAULTS.MAP_DEFAULT_CENTER),
            zoom: getMapConfig('MAP_DEFAULT_ZOOM', MAP_DEFAULTS.MAP_DEFAULT_ZOOM),
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT
            }
        });
    }

    // Clear existing polygons
    clearMap() {
        if (this.polygons && this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                polygon.setMap(null);
            });
            this.polygons = [];
        }
    }

    // Show loading indicator
    showLoading() {
        // Create the loading div if it doesn't exist
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
            
            // Add it to the map container, not the map itself
            const mapContainer = document.getElementById('map').parentNode;
            mapContainer.style.position = 'relative'; // Ensure container is positioned
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

    // Load and display areas on the map
    async loadAreas(councilId = null) {
        try {
            // Create the map if it doesn't exist
            if (!this.map) {
                this.initMap();
            }
            
            // Clear any existing overlays
            this.clearMap();
            
            // Set default date range if not specified
            if (!this.startDate || !this.endDate) {
                // Use Perth timezone with fallback
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
            
            // Silently pre-populate KML cache in the background
            try {
                await kmlService.generateKml(this.startDate, this.endDate, councilId);
            } catch (kmlError) {
                // Continue with direct rendering even if KML generation fails
            }
            
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
                        
                        for (const polygonData of areaPolygons) {
                            // Handle coordinates - convert from KML string format to Google Maps LatLng path
                            let paths = [];
                            try {
                                // First try to parse as JSON
                                const jsonPaths = JSON.parse(polygonData.coordinates);
                                paths = jsonPaths;
                            } catch (e) {
                                // If it's not valid JSON, assume it's KML format string and convert
                                // KML format: "lng1,lat1,alt1 lng2,lat2,alt2 ..."
                                paths = polygonData.coordinates.trim().split(' ').map(coord => {
                                    const parts = coord.split(',');
                                    if (parts.length >= 2) {
                                        return { 
                                            lat: parseFloat(parts[1]), 
                                            lng: parseFloat(parts[0])
                                        };
                                    }
                                    return null;
                                }).filter(point => point !== null);
                            }
                            
                            // Skip if no valid points
                            if (!paths || paths.length === 0) {
                                continue;
                            }
                            
                            // Get the appropriate color based on pickup date
                            const pickupDate = nextPickup.start_date;
                            // Use Perth timezone with fallback
                            const timezone = getMapConfig('TIMEZONE', MAP_DEFAULTS.TIMEZONE);
                            const today = moment().utcOffset(timezone).startOf('day');
                            const pickup = moment(pickupDate).utcOffset(timezone).startOf('day');
                            const daysUntilPickup = pickup.diff(today, 'days');
                            
                            // Determine which color to use based on days until pickup
                            const colors = getMapConfig('COLORS', MAP_DEFAULTS.COLORS);
                            let color = colors.DEFAULT;
                            
                            if (daysUntilPickup < 0) {
                                // Past date
                                color = colors.DEFAULT;
                            } else {
                                // Calculate which week we're in (0-14)
                                // For the first 7 days (0-6), use WEEK_0 (red)
                                const weekIndex = Math.min(Math.floor(daysUntilPickup / 7), 14);
                                color = colors[`WEEK_${weekIndex}`] || colors.DEFAULT;
                            }
                            
                            // Create the polygon
                            const polygon = new google.maps.Polygon({
                                paths: paths,
                                strokeColor: color,
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                                fillColor: color,
                                fillOpacity: 0.35,
                                map: this.map
                            });
                            
                            // Create info window content
                            const pickupDateFormatted = moment(pickupDate).format('dddd, MMMM D, YYYY');
                            const contentString = `
                                <div class="info-window">
                                    <h5>${area.name}</h5>
                                    <p><strong>Council:</strong> ${area.council ? area.council.name : area.council_id}</p>
                                    <p><strong>Next Pickup:</strong> ${pickupDateFormatted}</p>
                                </div>
                            `;
                            
                            // Add click listener for info window
                            const infoWindow = new google.maps.InfoWindow();
                            polygon.addListener('click', (event) => {
                                infoWindow.setContent(contentString);
                                infoWindow.setPosition(event.latLng);
                                infoWindow.open(this.map);
                            });
                            
                            this.polygons.push(polygon);
                        }
                    }
                }
            }
            
            // Fit the map to show all polygons
            if (this.polygons.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                this.polygons.forEach(polygon => {
                    try {
                        polygon.getPath().forEach(path => {
                            bounds.extend(path);
                        });
                    } catch (e) {
                        console.error('Error extending bounds:', e);
                    }
                });
                this.map.fitBounds(bounds);
            }
            
            // Hide loading indicator
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading areas:', error);
            this.hideLoading();
            // Just show an error message in the map area instead of using an alert
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

// Initialize the map when Google Maps API is ready
function initMap() {
    mapController.initMap();
    mapController.loadAreas();
}