// Supabase client for database interactions

class SupabaseClient {
    constructor() {
        // Make sure we're using the correct keys from CONFIG
        this.supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
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

    // Contact form
    async submitContactForm(contactData) {
        const { data, error } = await this.supabase
            .from('contact_submission')
            .insert([{ 
                ...contactData, 
                created_at: new Date().toISOString() 
            }])
            .select();
            
        if (error) {
            console.error('Error submitting contact form:', error);
            return null;
        }
        
        return data;
    }
}

// Create a singleton instance
const supabaseClient = new SupabaseClient();