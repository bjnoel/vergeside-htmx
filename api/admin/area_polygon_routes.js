// Admin API endpoints for area polygon management
const express = require('express');
const router = express.Router();

// This file will be imported in server.js and used with the admin API routes
module.exports = function(adminSupabase, requireAdminAuth) {
  // Get all polygons for an area
  router.get('/', requireAdminAuth, async (req, res) => {
    try {
      let query = adminSupabase
        .from('area_polygon')
        .select('*')
        .order('id');
      
      // Filter by area_id if provided
      if (req.query.area_id) {
        query = query.eq('area_id', req.query.area_id);
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

  // Get a single polygon by ID
  router.get('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const polygonId = parseInt(id, 10);
      if (isNaN(polygonId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid polygon ID' 
        });
      }
      
      const { data, error } = await adminSupabase
        .from('area_polygon')
        .select('*')
        .eq('id', polygonId)
        .single();
        
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data) {
        return res.status(404).json({ success: false, error: 'Polygon not found' });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Create a new polygon
  router.post('/', requireAdminAuth, async (req, res) => {
    try {
      const { area_id, active, coordinates } = req.body;
      
      // Validate required fields
      if (!area_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: area_id' 
        });
      }
      
      if (!coordinates) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required field: coordinates' 
        });
      }
      
      const insertData = {
        area_id: parseInt(area_id, 10),
        active: active !== undefined ? active : true,
        coordinates
      };
      
      console.log('Inserting polygon with data:', insertData);
      
      const { data, error } = await adminSupabase
        .from('area_polygon')
        .insert(insertData)
        .select();
        
      if (error) {
        console.error('Supabase error inserting polygon:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(500).json({ 
          success: false, 
          error: 'No data returned after insert' 
        });
      }
      
      console.log('Successfully created polygon:', data[0]);
      res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
      console.error('Admin API error creating polygon:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Update a polygon
  router.put('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const polygonId = parseInt(id, 10);
      if (isNaN(polygonId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid polygon ID' 
        });
      }
      
      const { area_id, active, coordinates } = req.body;
      
      // Build update data with only provided fields
      const updateData = {};
      if (area_id !== undefined) updateData.area_id = parseInt(area_id, 10);
      if (active !== undefined) updateData.active = active;
      if (coordinates !== undefined) updateData.coordinates = coordinates;
      
      console.log(`Updating polygon ${polygonId} with data:`, updateData);
      
      const { data, error } = await adminSupabase
        .from('area_polygon')
        .update(updateData)
        .eq('id', polygonId)
        .select();
        
      if (error) {
        console.error('Error updating polygon:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Polygon not found or no changes applied' 
        });
      }
      
      console.log('Polygon successfully updated:', data[0]);
      res.json({ success: true, data: data[0] });
    } catch (err) {
      console.error('Admin API error updating polygon:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Delete a polygon
  router.delete('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse the ID as an integer to ensure proper type matching
      const polygonId = parseInt(id, 10);
      if (isNaN(polygonId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid polygon ID' 
        });
      }
      
      console.log(`Deleting polygon with ID ${polygonId}`);
      
      const { error } = await adminSupabase
        .from('area_polygon')
        .delete()
        .eq('id', polygonId);
        
      if (error) {
        console.error('Error deleting polygon:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      console.log(`Polygon ${polygonId} deleted successfully`);
      res.json({ success: true, message: 'Polygon deleted successfully' });
    } catch (err) {
      console.error('Admin API error deleting polygon:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  return router;
};
