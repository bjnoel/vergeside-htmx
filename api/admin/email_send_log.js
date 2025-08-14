// Admin API endpoints for email send log management
const express = require('express');
const router = express.Router();

// This file will be imported in server.js and used with the admin API routes
module.exports = function(adminSupabase, requireAdminAuth) {
  // Get email send log with optional filtering and pagination
  router.get('/', requireAdminAuth, async (req, res) => {
    try {
      const { 
        status,
        email_type = 'weekly',
        page = 1, 
        limit = 20,
        order = 'sent_at.desc'
      } = req.query;

      let query = adminSupabase
        .from('email_send_log')
        .select('*', { count: 'exact' });

      // Apply status filter
      if (status && ['sent', 'failed', 'pending'].includes(status)) {
        query = query.eq('status', status);
      }

      // Apply email type filter
      if (email_type) {
        query = query.eq('email_type', email_type);
      }

      // Apply ordering
      const validOrders = [
        'sent_at.desc', 'sent_at.asc',
        'status.desc', 'status.asc',
        'email_type.desc', 'email_type.asc'
      ];
      
      if (validOrders.includes(order)) {
        const [field, direction] = order.split('.');
        query = query.order(field, { ascending: direction === 'asc' });
      } else {
        query = query.order('sent_at', { ascending: false });
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
        console.error('Error fetching email send log:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ 
        success: true, 
        data,
        pagination: {
          page: pageNum || 1,
          limit: limitNum || 20,
          total: count,
          pages: Math.ceil((count || 0) / (limitNum || 20))
        }
      });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Get email send statistics
  router.get('/stats', requireAdminAuth, async (req, res) => {
    try {
      // Get total sent count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: totalSent, error: totalError } = await adminSupabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', thirtyDaysAgo.toISOString());

      if (totalError) {
        console.error('Error fetching total sent count:', totalError);
        return res.status(400).json({ success: false, error: totalError.message });
      }

      // Get failed count (last 30 days)
      const { count: totalFailed, error: failedError } = await adminSupabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('sent_at', thirtyDaysAgo.toISOString());

      if (failedError) {
        console.error('Error fetching failed count:', failedError);
        return res.status(400).json({ success: false, error: failedError.message });
      }

      // Get last successful send
      const { data: lastSuccess, error: lastSuccessError } = await adminSupabase
        .from('email_send_log')
        .select('sent_at, recipient_count')
        .eq('status', 'sent')
        .eq('email_type', 'weekly')
        .order('sent_at', { ascending: false })
        .limit(1);

      if (lastSuccessError) {
        console.error('Error fetching last success:', lastSuccessError);
        return res.status(400).json({ success: false, error: lastSuccessError.message });
      }

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: recentActivity, error: recentError } = await adminSupabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', sevenDaysAgo.toISOString());

      if (recentError) {
        console.error('Error fetching recent activity:', recentError);
        return res.status(400).json({ success: false, error: recentError.message });
      }

      res.json({
        success: true,
        data: {
          total_sent_30d: totalSent || 0,
          total_failed_30d: totalFailed || 0,
          last_successful_send: lastSuccess && lastSuccess.length > 0 ? {
            sent_at: lastSuccess[0].sent_at,
            recipient_count: lastSuccess[0].recipient_count
          } : null,
          recent_activity_7d: recentActivity || 0
        }
      });
    } catch (err) {
      console.error('Admin API error fetching email stats:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Get a single email log entry by ID
  router.get('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid email log ID format' 
        });
      }
      
      const { data, error } = await adminSupabase
        .from('email_send_log')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ success: false, error: 'Email log entry not found' });
        }
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Create a new email log entry (typically used by the email sending system)
  router.post('/', requireAdminAuth, async (req, res) => {
    try {
      const { 
        email_type = 'weekly',
        recipient_count = 0,
        status = 'pending',
        error_message = null,
        metadata = null
      } = req.body;
      
      // Validate required fields and types
      if (!['weekly', 'test', 'manual'].includes(email_type)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid email_type. Must be: weekly, test, or manual' 
        });
      }

      if (!['pending', 'sent', 'failed'].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid status. Must be: pending, sent, or failed' 
        });
      }

      if (!Number.isInteger(recipient_count) || recipient_count < 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'recipient_count must be a non-negative integer' 
        });
      }
      
      const insertData = {
        email_type,
        recipient_count,
        status,
        error_message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        sent_at: new Date().toISOString()
      };
      
      const { data, error } = await adminSupabase
        .from('email_send_log')
        .insert(insertData)
        .select()
        .single();
        
      if (error) {
        console.error('Supabase error inserting email log:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('Admin API error creating email log:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Update an email log entry (typically to update status after sending)
  router.put('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid email log ID format' 
        });
      }
      
      const { 
        status,
        error_message,
        recipient_count,
        metadata
      } = req.body;
      
      // Build update data object with only provided fields
      const updateData = {};
      
      if (status !== undefined) {
        if (!['pending', 'sent', 'failed'].includes(status)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid status. Must be: pending, sent, or failed' 
          });
        }
        updateData.status = status;
      }

      if (error_message !== undefined) {
        updateData.error_message = error_message;
      }

      if (recipient_count !== undefined) {
        if (!Number.isInteger(recipient_count) || recipient_count < 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'recipient_count must be a non-negative integer' 
          });
        }
        updateData.recipient_count = recipient_count;
      }

      if (metadata !== undefined) {
        updateData.metadata = metadata ? JSON.stringify(metadata) : null;
      }

      // Always update the sent_at timestamp when updating
      updateData.sent_at = new Date().toISOString();

      if (Object.keys(updateData).length === 1) { // Only sent_at was added
        return res.status(400).json({ 
          success: false, 
          error: 'No valid fields provided for update' 
        });
      }
      
      const { data, error } = await adminSupabase
        .from('email_send_log')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ success: false, error: 'Email log entry not found' });
        }
        console.error('Error updating email log:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error('Admin API error updating email log:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // Delete an email log entry (admin only, for cleanup)
  router.delete('/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid email log ID format' 
        });
      }
      
      const { error } = await adminSupabase
        .from('email_send_log')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting email log:', error);
        return res.status(400).json({ success: false, error: error.message });
      }
      
      res.json({ success: true, message: 'Email log entry deleted successfully' });
    } catch (err) {
      console.error('Admin API error deleting email log:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  return router;
};