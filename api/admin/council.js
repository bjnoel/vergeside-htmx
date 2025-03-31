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
      const { name, council_url, bulk_waste_url, info, has_pickups, active } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: name' 
        });
      }
      
      const insertData = {
        name,
        council_url: council_url || null,
        bulk_waste_url: bulk_waste_url || null,
        info: info || null,
        has_pickups: has_pickups !== undefined ? has_pickups : true,
        active: active !== undefined ? active : true
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
      
      const { name, council_url, bulk_waste_url, info, has_pickups, active } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: name' 
        });
      }
      
      const updateData = {
        name,
        council_url: council_url || null,
        bulk_waste_url: bulk_waste_url || null,
        info: info || null,
        has_pickups: has_pickups !== undefined ? has_pickups : true,
        active: active !== undefined ? active : true
      };
      
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

  // Delete a council (or set inactive)
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
      
      // Instead of actually deleting, we'll set active to false (soft delete)
      const { error } = await adminSupabase
        .from('council')
        .update({ active: false })
        .eq('id', councilId);
        
      if (error) {
        console.error('Error deactivating council:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      console.log(`Council ${councilId} deactivated successfully`);
      res.json({ success: true, message: 'Council deactivated successfully' });
    } catch (err) {
      console.error('Admin API error deactivating council:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  return router;
};
