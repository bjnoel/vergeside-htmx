// Admin API endpoints for email subscriber management
const express = require('express');
const router = express.Router();

// This file will be imported in server.js and used with the admin API routes
module.exports = function(adminSupabase, requireAdminAuth) {
  // Get all email subscribers with optional filtering and pagination
  router.get('/', requireAdminAuth, async (req, res) => {
    try {
      const { 
        search, 
        status, 
        page = 1, 
        limit = 50,
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      let query = adminSupabase
        .from('email_subscribers')
        .select('*', { count: 'exact' });

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      // Apply status filter
      if (status !== undefined && status !== '') {
        query = query.eq('is_active', status === 'true');
      }

      // Apply sorting
      const validSortFields = ['name', 'email', 'created_at', 'updated_at', 'is_active'];
      const validOrders = ['asc', 'desc'];
      
      if (validSortFields.includes(sort) && validOrders.includes(order)) {
        query = query.order(sort, { ascending: order === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (!isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0) {
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;
        
      if (error) {
        console.error('Error fetching subscribers:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ 
        success: true, 
        data,
        pagination: {
          page: pageNum || 1,
          limit: limitNum || 50,
          total: count,
          pages: Math.ceil((count || 0) / (limitNum || 50))
        }
      });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Get subscriber statistics
  router.get('/stats', requireAdminAuth, async (req, res) => {
    try {
      // Get total count
      const { count: totalCount, error: totalError } = await adminSupabase
        .from('email_subscribers')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('Error fetching total count:', totalError);
        return res.status(400).json({ success: false, error: totalError.message });
      }

      // Get active count
      const { count: activeCount, error: activeError } = await adminSupabase
        .from('email_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (activeError) {
        console.error('Error fetching active count:', activeError);
        return res.status(400).json({ success: false, error: activeError.message });
      }

      // Get recent count (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: recentCount, error: recentError } = await adminSupabase
        .from('email_subscribers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());

      if (recentError) {
        console.error('Error fetching recent count:', recentError);
        return res.status(400).json({ success: false, error: recentError.message });
      }

      res.json({
        success: true,
        data: {
          total: totalCount || 0,
          active: activeCount || 0,
          inactive: (totalCount || 0) - (activeCount || 0),
          recent: recentCount || 0
        }
      });
    } catch (err) {
      console.error('Admin API error fetching stats:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Get a single subscriber by ID
  router.get('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid subscriber ID format' 
        });
      }
      
      const { data, error } = await adminSupabase
        .from('email_subscribers')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ success: false, error: 'Subscriber not found' });
        }
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Create a new subscriber
  router.post('/', requireAdminAuth, async (req, res) => {
    try {
      const { name, email, is_active = true } = req.body;
      
      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: name and email' 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      const insertData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        is_active: Boolean(is_active)
      };
      
      const { data, error } = await adminSupabase
        .from('email_subscribers')
        .insert(insertData)
        .select()
        .single();
        
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          return res.status(409).json({ 
            success: false, 
            error: 'Email address already exists' 
          });
        }
        console.error('Supabase error inserting subscriber:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('Admin API error creating subscriber:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Update a subscriber
  router.put('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid subscriber ID format' 
        });
      }
      
      const { name, email, is_active } = req.body;
      
      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: name and email' 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      const updateData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        is_active: Boolean(is_active),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await adminSupabase
        .from('email_subscribers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ success: false, error: 'Subscriber not found' });
        }
        if (error.code === '23505') { // Unique constraint violation
          return res.status(409).json({ 
            success: false, 
            error: 'Email address already exists' 
          });
        }
        console.error('Error updating subscriber:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error updating subscriber:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Delete a subscriber
  router.delete('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid subscriber ID format' 
        });
      }
      
      const { error } = await adminSupabase
        .from('email_subscribers')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting subscriber:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, message: 'Subscriber deleted successfully' });
    } catch (err) {
      console.error('Admin API error deleting subscriber:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Bulk update subscribers (activate/deactivate)
  router.patch('/bulk', requireAdminAuth, async (req, res) => {
    try {
      const { ids, is_active } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing or invalid ids array' 
        });
      }

      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ 
          success: false, 
          error: 'is_active must be a boolean' 
        });
      }

      // Validate all IDs are valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of ids) {
        if (!uuidRegex.test(id)) {
          return res.status(400).json({ 
            success: false, 
            error: `Invalid subscriber ID format: ${id}` 
          });
        }
      }
      
      const { data, error } = await adminSupabase
        .from('email_subscribers')
        .update({ 
          is_active, 
          updated_at: new Date().toISOString() 
        })
        .in('id', ids)
        .select();
        
      if (error) {
        console.error('Error bulk updating subscribers:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ 
        success: true, 
        message: `${data.length} subscribers updated successfully`,
        data
      });
    } catch (err) {
      console.error('Admin API error bulk updating subscribers:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Bulk delete subscribers
  router.delete('/bulk', requireAdminAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing or invalid ids array' 
        });
      }

      // Validate all IDs are valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of ids) {
        if (!uuidRegex.test(id)) {
          return res.status(400).json({ 
            success: false, 
            error: `Invalid subscriber ID format: ${id}` 
          });
        }
      }
      
      const { error } = await adminSupabase
        .from('email_subscribers')
        .delete()
        .in('id', ids);
        
      if (error) {
        console.error('Error bulk deleting subscribers:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ 
        success: true, 
        message: `Subscribers deleted successfully`
      });
    } catch (err) {
      console.error('Admin API error bulk deleting subscribers:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  return router;
};