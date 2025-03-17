// API handler for area-related endpoints using Supabase
import { supabaseClient } from '../../js/supabase-client.js';

export async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const councilId = req.query.council_id;
      
      // Use the existing Supabase client to fetch areas
      const areas = await supabaseClient.getAreas(councilId || null);
      
      return res.status(200).json(areas);
    } catch (error) {
      console.error('Error fetching areas:', error);
      return res.status(500).json({ error: 'Failed to fetch areas' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}