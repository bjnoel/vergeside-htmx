// Supabase client for database interactions

class SupabaseClient {
    constructor() {
        // Get configuration values, with fallbacks if CONFIG is not defined yet
        const supabaseUrl = (window.CONFIG && CONFIG.SUPABASE_URL) || 
                            (window.ENV && ENV.SUPABASE_URL) || 
                            'https://wihegqwakwwvckxrivem.supabase.co';
        
        const supabaseAnonKey = (window.CONFIG && CONFIG.SUPABASE_ANON_KEY) || 
                               (window.ENV && ENV.SUPABASE_ANON_KEY) || 
                               'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGVncXdha3d3dmNreHJpdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2Mzg1NDksImV4cCI6MjA1NjIxNDU0OX0.aP2ThYybxtUE6JaVHs1sowZaDfAbxxPC_yBotY5qApM';
        
        // Create the Supabase client with the appropriate values
        this.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
        this.schema = "";
    }

    // Councils
    async getCouncils() {
        const { data, error } = await this.supabase
            .from('council')
            .select('*');
            
        if (error) {
            console.error('Error fetching councils:', error);
            return [];
        }
        
        return data;
    }

    async getCouncilById(id) {
        const { data, error } = await this.supabase
            .from('council')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) {
            console.error(`Error fetching council with id ${id}:`, error);
            return null;
        }
        
        return data;
    }

    // Areas
    async getAreas(councilId = null) {
        let query = this.supabase
            .from('area')
            .select(`*, council(id, name)`);
            
        if (councilId) {
            query = query.eq('council_id', councilId);
        }
        
        const { data, error } = await query;
            
        if (error) {
            console.error('Error fetching areas:', error);
            return [];
        }
        
        return data;
    }

    async getAreaById(id) {
        const { data, error } = await this.supabase
            .from('area')
            .select(`*, council(id, name)`)
            .eq('id', id)
            .single();
            
        if (error) {
            console.error(`Error fetching area with id ${id}:`, error);
            return null;
        }
        
        return data;
    }

    // Area polygons
    async getAreaPolygons(areaId) {
        // Check if there's a request cache available
        if (window.requestCache) {
            const cacheKey = `area_polygon_${areaId}`;
            return window.requestCache.execute(cacheKey, async () => {
                // Actual request implementation
                const { data, error } = await this.supabase
                    .from('area_polygon')
                    .select('*')
                    .eq('area_id', areaId);
                    
                if (error) {
                    console.error(`Error fetching polygons for area ${areaId}:`, error);
                    return [];
                }
                
                return data || [];
            });
        } else {
            // Fallback to direct request if cache isn't available
            const { data, error } = await this.supabase
                .from('area_polygon')
                .select('*')
                .eq('area_id', areaId);
                
            if (error) {
                console.error(`Error fetching polygons for area ${areaId}:`, error);
                return [];
            }
            
            return data || [];
        }
    }

    // Area pickups - fixed to use start_date instead of pickup_date
    async getAreaPickups(areaId, startDate, endDate) {
        const { data, error } = await this.supabase
            .from('area_pickup')
            .select('*')
            .eq('area_id', areaId)
            .gte('start_date', startDate)
            .lte('start_date', endDate)
            .order('start_date', { ascending: true });
            
        if (error) {
            console.error(`Error fetching pickups for area ${areaId}:`, error);
            return [];
        }
        
        return data || [];
    }

    // Get all pickups across all areas - fixed to use start_date instead of pickup_date
    async getAllPickups(startDate, endDate) {
        const { data, error } = await this.supabase
            .from('area_pickup')
            .select(`*, area(*)`)
            .gte('start_date', startDate)
            .lte('start_date', endDate)
            .order('start_date', { ascending: true });
            
        if (error) {
            console.error('Error fetching all pickups:', error);
            return [];
        }
        
        return data || [];
    }
    
    // NEW: Get consolidated data with pickups, areas, and polygons in one request
    async getConsolidatedData(startDate, endDate, councilId = null) {
        console.log('Getting consolidated data for', { startDate, endDate, councilId });
        
        // Generate cache key for this specific request
        const cacheKey = `consolidated_${startDate}_${endDate}_${councilId || 'all'}`;
        
        // Use request cache if available
        if (window.requestCache) {
            return window.requestCache.execute(cacheKey, async () => {
                return this._fetchConsolidatedData(startDate, endDate, councilId);
            });
        } else {
            // Fallback if cache is not available
            return this._fetchConsolidatedData(startDate, endDate, councilId);
        }
    }
    
    // Private method to actually fetch consolidated data
    async _fetchConsolidatedData(startDate, endDate, councilId = null) {
        try {
            // Get all pickups for the date range with their areas
            let query = this.supabase
                .from('area_pickup')
                .select(`
                    *,
                    area!inner(*, 
                         council(*),
                         area_polygon(*))
                `)
                .gte('start_date', startDate)
                .lte('start_date', endDate)
                .order('start_date', { ascending: true });
            
            // Add council filter if specified
            if (councilId) {
                query = query.eq('area.council_id', councilId);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Error fetching consolidated data:', error);
                return { pickups: [], areas: [], polygonsByArea: {} };
            }
            
            if (!data || data.length === 0) {
                return { pickups: [], areas: [], polygonsByArea: {} };
            }
            
            // Extract unique areas
            const areasMap = new Map();
            const pickups = [];
            const polygonsByArea = {};
            
            data.forEach(pickup => {
                // Add the pickup
                pickups.push({
                    ...pickup,
                    area_id: pickup.area_id
                });
                
                // Add the area if not already added
                if (!areasMap.has(pickup.area.id)) {
                    areasMap.set(pickup.area.id, pickup.area);
                    
                    // Store polygons for this area
                    if (pickup.area.area_polygon && pickup.area.area_polygon.length > 0) {
                        polygonsByArea[pickup.area.id] = pickup.area.area_polygon;
                    }
                }
            });
            
            const areas = Array.from(areasMap.values());
            
            console.log(`Consolidated data: ${pickups.length} pickups, ${areas.length} areas with polygons`);
            
            return { pickups, areas, polygonsByArea };
        } catch (err) {
            console.error('Error in _fetchConsolidatedData:', err);
            return { pickups: [], areas: [], polygonsByArea: {} };
        }
    }

    // Contact form is now handled by FormSubmit.co
}

// Create a singleton instance
const supabaseClient = new SupabaseClient();