// API handler for council-related endpoints using Supabase
import { supabaseClient } from '../../js/supabase-client.js';

export async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Use the Supabase client to fetch councils
      const councils = await supabaseClient.getCouncils();
      
      return res.status(200).json(councils);
    } catch (error) {
      console.error('Error fetching councils:', error);
      return res.status(500).json({ error: 'Failed to fetch councils' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}