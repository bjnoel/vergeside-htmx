// Admin API endpoints for area management
const express = require('express');
const router = express.Router();

// This file will be imported in server.js and used with the admin API routes
module.exports = function(adminSupabase, requireAdminAuth) {
  // Get all areas with optional council_id filter
  router.get('/', requireAdminAuth, async (req, res) => {
    try {
      let query = adminSupabase
        .from('area')
        .select(`
          *,
          council:council_id (
            id, 
            name
          )
        `)
        .order('name');
      
      // Filter by council if requested
      if (req.query.council_id) {
        query = query.eq('council_id', req.query.council_id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Get a single area by ID
  router.get('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const areaId = parseInt(id, 10);
      if (isNaN(areaId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid area ID' 
        });
      }
      
      const { data, error } = await adminSupabase
        .from('area')
        .select(`
          *,
          council:council_id (
            id, 
            name
          )
        `)
        .eq('id', areaId)
        .single();
        
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data) {
        return res.status(404).json({ success: false, error: 'Area not found' });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Create a new area
  router.post('/', requireAdminAuth, async (req, res) => {
    try {
      const { name, council_id } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: name' 
        });
      }
      
      if (!council_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: council_id' 
        });
      }
      
      const insertData = {
        name,
        council_id: parseInt(council_id, 10)
      };
      
      console.log('Inserting area with data:', insertData);
      
      const { data, error } = await adminSupabase
        .from('area')
        .insert(insertData)
        .select();
        
      if (error) {
        console.error('Supabase error inserting area:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(500).json({ 
          success: false, 
          error: 'No data returned after insert' 
        });
      }
      
      console.log('Successfully created area:', data[0]);
      res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
      console.error('Admin API error creating area:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Update an area
  router.put('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const areaId = parseInt(id, 10);
      if (isNaN(areaId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid area ID' 
        });
      }
      
      const { name, council_id } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: name' 
        });
      }
      
      if (!council_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: council_id' 
        });
      }
      
      const updateData = {
        name,
        council_id: parseInt(council_id, 10)
      };
      
      console.log(`Updating area ${areaId} with data:`, updateData);
      
      const { data, error } = await adminSupabase
        .from('area')
        .update(updateData)
        .eq('id', areaId)
        .select();
        
      if (error) {
        console.error('Error updating area:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Area not found or no changes applied' 
        });
      }
      
      console.log('Area successfully updated:', data[0]);
      res.json({ success: true, data: data[0] });
    } catch (err) {
      console.error('Admin API error updating area:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Delete an area
  router.delete('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const areaId = parseInt(id, 10);
      if (isNaN(areaId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid area ID' 
        });
      }
      
      console.log(`Deleting area with ID ${areaId}`);
      
      const { error } = await adminSupabase
        .from('area')
        .delete()
        .eq('id', areaId);
        
      if (error) {
        console.error('Error deleting area:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      console.log(`Area ${areaId} deleted successfully`);
      res.json({ success: true, message: 'Area deleted successfully' });
    } catch (err) {
      console.error('Admin API error deleting area:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  return router;
};
