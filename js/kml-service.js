// KML generation service for map display

class KmlService {
    constructor() {
        this.styles = this.generateStyles();
        this.debugMode = false; // Disable debug logging
    }

    // Debug log
    debug(message, data = null) {
        if (this.debugMode) {
            if (data) {
                console.log(`[KmlService] ${message}`, data);
            } else {
                console.log(`[KmlService] ${message}`);
            }
        }
    }

    // Generates KML styles based on the color scheme
    generateStyles() {
        const styles = [];
        
        // Create style entries for each color in the configuration
        Object.entries(CONFIG.COLORS).forEach(([key, color]) => {
            // Convert hex color to KML format (aabbggrr)
            const hexColor = color.replace('#', '');
            const r = hexColor.substr(0, 2);
            const g = hexColor.substr(2, 2);
            const b = hexColor.substr(4, 2);
            const kmlColor = `ff${b}${g}${r}`; // KML uses aabbggrr format
            
            // Create normal style
            const normalOpacity = 'ff';
            const highlightOpacity = '73';
            
            styles.push({
                name: key.toLowerCase(),
                lineColor: `${normalOpacity}${b}${g}${r}`,
                polyColor: `${normalOpacity}${b}${g}${r}`,
                highlightLineColor: `${highlightOpacity}${b}${g}${r}`,
                highlightPolyColor: `${highlightOpacity}${b}${g}${r}`
            });
        });
        
        return styles;
    }

    // Determines which color/style to use based on the pickup date
    getStyleForDate(pickupDate) {
        // Use Perth timezone specified in CONFIG
        const today = moment().utcOffset(CONFIG.TIMEZONE).startOf('day');
        const pickup = moment(pickupDate).utcOffset(CONFIG.TIMEZONE).startOf('day');
        const daysUntilPickup = pickup.diff(today, 'days');
        
        if (daysUntilPickup < 0) {
            return 'default';
        } else {
            // Calculate which week we're in (0-14)
            const weekIndex = Math.min(Math.floor(daysUntilPickup / 7), 14);
            return `week_${weekIndex}`;
        }
    }

    // Format pickup dates similarly to the C# implementation
    formatPickupDates(pickups) {
        if (!pickups || pickups.length === 0) return '';
        
        // Sort pickups by date and extract unique dates
        const startDates = [...new Set(
            pickups
                .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                .map(p => moment(p.start_date).format('DD MMM YYYY'))
        )];
        
        return startDates.join(' and ');
    }

    // Parse coordinates from string format: "lng1,lat1,alt1 lng2,lat2,alt2 ..."
    parseCoordinates(coordinateString) {
        if (!coordinateString || coordinateString.trim() === '') {
            return '';
        }
        
        // Check if already a string in KML format
        if (typeof coordinateString === 'string' && !coordinateString.startsWith('[')) {
            return coordinateString;
        }
        
        // If it's stored as JSON, convert to KML coordinate format
        try {
            const coordsArray = typeof coordinateString === 'string' 
                ? JSON.parse(coordinateString) 
                : coordinateString;
            
            return coordsArray.map(coord => {
                return `${coord.lng},${coord.lat},0`;
            }).join(' ');
        } catch (error) {
            this.debug("Error parsing coordinates:", error);
            return coordinateString; // Return as is if parsing fails
        }
    }

    // Generate KML for a single area with its pickups and polygons
    generateAreaKml(area, pickups, polygons) {
        if (!pickups || pickups.length === 0 || !polygons || polygons.length === 0) {
            return '';
        }

        // Sort pickups by date
        const sortedPickups = [...pickups].sort((a, b) => 
            new Date(a.start_date) - new Date(b.start_date)
        );
        
        // Get the earliest pickup date to determine the style
        const nextPickupDate = sortedPickups[0].start_date;
        const styleKey = this.getStyleForDate(nextPickupDate);
        
        // Build polygons XML
        let polygonsXml = '';
        try {
            if (polygons.length === 1) {
                // The coordinates are already in KML format or JSON
                const coordinates = this.parseCoordinates(polygons[0].coordinates);
                
                polygonsXml = `
                    <Polygon>
                        <outerBoundaryIs>
                            <LinearRing>
                                <tessellate>1</tessellate>
                                <coordinates>${coordinates}</coordinates>
                            </LinearRing>
                        </outerBoundaryIs>
                    </Polygon>
                `;
            } else {
                let multiPolygonXml = '';
                polygons.forEach((polygon) => {
                    // The coordinates are already in KML format or JSON
                    const coordinates = this.parseCoordinates(polygon.coordinates);
                    
                    multiPolygonXml += `
                        <Polygon>
                            <outerBoundaryIs>
                                <LinearRing>
                                    <tessellate>1</tessellate>
                                    <coordinates>${coordinates}</coordinates>
                                </LinearRing>
                            </outerBoundaryIs>
                        </Polygon>
                    `;
                });
                
                polygonsXml = `
                    <MultiGeometry>
                        ${multiPolygonXml}
                    </MultiGeometry>
                `;
            }
        } catch (error) {
            this.debug("Error building polygon XML:", error);
            // Return empty XML in case of error
            polygonsXml = '';
        }
        
        // Format description with pickup dates
        const description = this.formatPickupDates(sortedPickups);
        
        // Return the KML for this area
        return `
            <Placemark>
                <n>${area.name}</n>
                <description>${description}</description>
                <styleUrl>#${styleKey}</styleUrl>
                ${polygonsXml}
            </Placemark>
        `;
    }

    // Generate style definitions for the KML document
    generateStylesKml() {
        let stylesXml = '';
        
        this.styles.forEach(style => {
            // Normal style
            stylesXml += `
                <Style id="${style.name}-normal">
                    <LineStyle>
                        <color>${style.lineColor}</color>
                        <width>3</width>
                    </LineStyle>
                    <PolyStyle>
                        <color>${style.polyColor}</color>
                        <fill>1</fill>
                        <outline>1</outline>
                    </PolyStyle>
                </Style>
            `;
            
            // Highlight style
            stylesXml += `
                <Style id="${style.name}-highlight">
                    <LineStyle>
                        <color>${style.highlightLineColor}</color>
                        <width>4.5</width>
                    </LineStyle>
                    <PolyStyle>
                        <color>${style.highlightPolyColor}</color>
                        <fill>1</fill>
                        <outline>1</outline>
                    </PolyStyle>
                </Style>
            `;
            
            // Style map
            stylesXml += `
                <StyleMap id="${style.name}">
                    <Pair>
                        <key>normal</key>
                        <styleUrl>#${style.name}-normal</styleUrl>
                    </Pair>
                    <Pair>
                        <key>highlight</key>
                        <styleUrl>#${style.name}-highlight</styleUrl>
                    </Pair>
                </StyleMap>
            `;
        });
        
        return stylesXml;
    }

    // Generate the complete KML document
    async generateKml(startDate, endDate, councilId = null) {
        try {
            // First, try to retrieve from cache if available
            const cacheKey = this.generateCacheKey(startDate, endDate, councilId);
            this.debug(`Checking cache for key: ${cacheKey}`);
            
            const cachedKml = await this.getFromCache(cacheKey);
            
            if (cachedKml) {
                this.debug('Retrieved KML from cache');
                return cachedKml;
            }
            
            // Not in cache, generate new KML
            this.debug('Generating new KML document');
            
            // Fetch all areas, pickups, and polygons needed
            const pickups = await supabaseClient.getAllPickups(startDate, endDate);
            const areas = await supabaseClient.getAreas(councilId);
            
            this.debug(`Fetched ${pickups.length} pickups and ${areas.length} areas`);
            
            // Group pickups by area
            const areaPickupMap = new Map();
            pickups.forEach(pickup => {
                if (!areaPickupMap.has(pickup.area_id)) {
                    areaPickupMap.set(pickup.area_id, []);
                }
                areaPickupMap.get(pickup.area_id).push(pickup);
            });
            
            // Generate KML for each area
            let placemarkXml = '';
            for (const area of areas) {
                if (areaPickupMap.has(area.id)) {
                    const areaPickups = areaPickupMap.get(area.id);
                    if (areaPickups && areaPickups.length > 0) {
                        const polygons = await supabaseClient.getAreaPolygons(area.id);
                        if (polygons.length > 0) {
                            placemarkXml += this.generateAreaKml(area, areaPickups, polygons);
                        }
                    }
                }
            }
            
            // Assemble the complete KML document
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
                <kml xmlns="http://www.opengis.net/kml/2.2">
                    <Document>
                        <n>Vergeside Pickups</n>
                        <description>Vergeside collection dates from ${startDate} to ${endDate}</description>
                        ${this.generateStylesKml()}
                        <Folder>
                            <n>Vergeside Overlays</n>
                            ${placemarkXml}
                        </Folder>
                    </Document>
                </kml>
            `;
            
            // Store in cache for future use
            this.debug('Storing KML in cache');
            await this.storeInCache(cacheKey, kml, { startDate, endDate, councilId });
            
            return kml;
        } catch (error) {
            this.debug('Error generating KML:', error);
            return null;
        }
    }
    
    // Generate a cache key for KML
    generateCacheKey(startDate, endDate, councilId = null) {
        // Create a string that uniquely identifies this KML request
        const keyParts = [
            'kml',
            startDate,
            endDate,
            councilId || 'all'
        ];
        
        return keyParts.join('-');
    }
    
    // Get KML from cache
    async getFromCache(cacheKey) {
        try {
            this.debug(`Checking cache for: ${cacheKey}`);
            
            // First check if the kml_cache table exists
            try {
                const { count, error: tableError } = await supabaseClient.supabase
                    .from('kml_cache')
                    .select('*', { count: 'exact', head: true });
                
                if (tableError) {
                    this.debug('Error checking kml_cache table:', tableError);
                    return null;
                }
                
                this.debug(`kml_cache table exists with ${count} entries`);
            } catch (e) {
                this.debug('kml_cache table might not exist:', e);
                return null;
            }
            
            const { data, error } = await supabaseClient.supabase
                .from('kml_cache')
                .select('kml_content, created_at')
                .eq('cache_key', cacheKey)
                .single();
                
            if (error) {
                this.debug('Cache retrieval error:', error);
                return null;
            }
            
            if (!data) {
                this.debug('No cache entry found');
                return null;
            }
            
            // Check if cache is still valid (less than 24 hours old)
            const createdAt = new Date(data.created_at);
            const now = new Date();
            const cacheAge = (now - createdAt) / (1000 * 60 * 60); // in hours
            
            if (cacheAge < 24) {
                this.debug(`Cache hit! Age: ${cacheAge.toFixed(2)} hours`);
                return data.kml_content;
            }
            
            // Cache is stale, remove it
            this.debug('Cache entry is stale, removing it');
            await supabaseClient.supabase
                .from('kml_cache')
                .delete()
                .eq('cache_key', cacheKey);
                
            return null;
        } catch (err) {
            this.debug('Error retrieving KML from cache:', err);
            return null;
        }
    }
    
    // Store KML in cache
    async storeInCache(cacheKey, kmlContent, params) {
        try {
            this.debug(`Storing in cache with key: ${cacheKey}`);
            this.debug('Parameters:', params);
            
            // Check if the entry already exists (to avoid unique constraint violation)
            const { data: existing, error: checkError } = await supabaseClient.supabase
                .from('kml_cache')
                .select('id')
                .eq('cache_key', cacheKey)
                .maybeSingle();
                
            if (checkError) {
                this.debug('Error checking for existing cache entry:', checkError);
                return;
            }
            
            if (existing) {
                // Update existing entry
                this.debug('Updating existing cache entry');
                const { data, error } = await supabaseClient.supabase
                    .from('kml_cache')
                    .update({
                        kml_content: kmlContent,
                        parameters: params,
                        created_at: new Date().toISOString()
                    })
                    .eq('cache_key', cacheKey);
                    
                if (error) {
                    this.debug('Error updating cache:', error);
                } else {
                    this.debug('Cache updated successfully');
                }
            } else {
                // Insert new entry
                this.debug('Inserting new cache entry');
                const { data, error } = await supabaseClient.supabase
                    .from('kml_cache')
                    .insert([{
                        cache_key: cacheKey,
                        kml_content: kmlContent,
                        parameters: params,
                        created_at: new Date().toISOString()
                    }]);
                    
                if (error) {
                    this.debug('Error storing KML in cache:', error);
                } else {
                    this.debug('KML stored in cache successfully');
                }
            }
        } catch (err) {
            this.debug('Error storing KML in cache:', err);
        }
    }
    
    // Test the caching mechanism
    async testCacheSystem() {
        try {
            this.debug('TESTING CACHE SYSTEM');
            
            // Generate a test key
            const testKey = 'test-cache-' + Date.now();
            const testContent = `<kml><Document><name>Test KML</name></Document></kml>`;
            const testParams = { test: true, timestamp: Date.now() };
            
            // Try to store in cache
            this.debug('Storing test data in cache');
            await this.storeInCache(testKey, testContent, testParams);
            
            // Try to retrieve from cache
            this.debug('Retrieving test data from cache');
            const retrieved = await this.getFromCache(testKey);
            
            if (retrieved === testContent) {
                this.debug('CACHE TEST SUCCESSFUL: Data retrieved matches data stored');
                return true;
            } else {
                this.debug('CACHE TEST FAILED: Retrieved data doesn\'t match or was not found');
                this.debug('Retrieved:', retrieved);
                return false;
            }
        } catch (err) {
            this.debug('CACHE TEST ERROR:', err);
            return false;
        }
    }
}

// Create a singleton instance
const kmlService = new KmlService();

// Cache test disabled in production
