// Admin API endpoints for council management
const express = require('express');
const router = express.Router();

// This file will be imported in server.js and used with the admin API routes
module.exports = function(adminSupabase, requireAdminAuth) {
  // Get all councils
  router.get('/', requireAdminAuth, async (req, res) => {
    try {
      const { data, error } = await adminSupabase
        .from('council')
        .select('*')
        .order('name');
        
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Get a single council by ID
  router.get('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const councilId = parseInt(id, 10);
      if (isNaN(councilId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid council ID' 
        });
      }
      
      const { data, error } = await adminSupabase
        .from('council')
        .select('*')
        .eq('id', councilId)
        .single();
        
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data) {
        return res.status(404).json({ success: false, error: 'Council not found' });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Create a new council
  router.post('/', requireAdminAuth, async (req, res) => {
    try {
      const { name, council_url, bulk_waste_url, has_pickups, date_last_checked } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: name' 
        });
      }
      
      if (!council_url) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: council_url' 
        });
      }
      
      // Prepare the insert data with only fields that exist in the schema
      const insertData = {
        name,
        council_url,
        bulk_waste_url: bulk_waste_url || null,
        has_pickups: has_pickups !== undefined ? has_pickups : true,
        date_last_checked: date_last_checked || null
      };
      
      console.log('Inserting council with data:', insertData);
      
      const { data, error } = await adminSupabase
        .from('council')
        .insert(insertData)
        .select();
        
      if (error) {
        console.error('Supabase error inserting council:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(500).json({ 
          success: false, 
          error: 'No data returned after insert' 
        });
      }
      
      console.log('Successfully created council:', data[0]);
      res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
      console.error('Admin API error creating council:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Update a council
  router.put('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const councilId = parseInt(id, 10);
      if (isNaN(councilId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid council ID' 
        });
      }
      
      const { name, council_url, bulk_waste_url, has_pickups, date_last_checked } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: name' 
        });
      }
      
      if (!council_url) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: council_url' 
        });
      }
      
      // Prepare the update data with only fields that exist in the schema
      const updateData = {
        name,
        council_url,
        bulk_waste_url: bulk_waste_url || null,
        has_pickups: has_pickups !== undefined ? has_pickups : true
      };
      
      // Only include date_last_checked if it's provided
      if (date_last_checked !== undefined) {
        updateData.date_last_checked = date_last_checked;
      }
      
      console.log(`Updating council ${councilId} with data:`, updateData);
      
      const { data, error } = await adminSupabase
        .from('council')
        .update(updateData)
        .eq('id', councilId)
        .select();
        
      if (error) {
        console.error('Error updating council:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Council not found or no changes applied' 
        });
      }
      
      console.log('Council successfully updated:', data[0]);
      res.json({ success: true, data: data[0] });
    } catch (err) {
      console.error('Admin API error updating council:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Delete a council
  router.delete('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const councilId = parseInt(id, 10);
      if (isNaN(councilId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid council ID' 
        });
      }
      
      const { error } = await adminSupabase
        .from('council')
        .delete()
        .eq('id', councilId);
        
      if (error) {
        console.error('Error deleting council:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      console.log(`Council ${councilId} deleted successfully`);
      res.json({ success: true, message: 'Council deleted successfully' });
    } catch (err) {
      console.error('Admin API error deleting council:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  return router;
};
