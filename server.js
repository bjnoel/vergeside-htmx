// Simple Express server for Vergeside Admin
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Simple request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create a special Supabase client with service role for admin operations (bypasses RLS)
const adminSupabase = createClient(
  process.env.SUPABASE_URL || 'https://wihegqwakwwvckxrivem.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Regular Supabase client for public operations
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://wihegqwakwwvckxrivem.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGVncXdha3d3dmNreHJpdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2Mzg1NDksImV4cCI6MjA1NjIxNDU0OX0.aP2ThYybxtUE6JaVHs1sowZaDfAbxxPC_yBotY5qApM'
);

// Auth0 configuration
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || 'your-domain.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || 'your-client-secret',
  callbackUrl: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/api/auth/callback'
};

// Dynamically inject environment variables into env-config.js
app.get('/js/env-config.js', (req, res) => {
  const envConfigJs = `
    // This file is dynamically generated by the server
    // It provides environment variables to the client-side code
    // without exposing sensitive keys in source control
    (function() {
      window.ENV = window.ENV || {};
      
      // Supabase configuration
      window.ENV.SUPABASE_URL = "${process.env.SUPABASE_URL || 'https://wihegqwakwwvckxrivem.supabase.co'}";
      window.ENV.SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGVncXdha3d3dmNreHJpdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2Mzg1NDksImV4cCI6MjA1NjIxNDU0OX0.aP2ThYybxtUE6JaVHs1sowZaDfAbxxPC_yBotY5qApM'}";
      
      // Maps API key
      window.ENV.MAPS_API_KEY = "${process.env.MAPS_API_KEY || ''}";
      
      // Map configuration
      window.ENV.MAP_DEFAULT_CENTER = { lat: -31.9505, lng: 115.8605 };
      window.ENV.MAP_DEFAULT_ZOOM = 10;
      window.ENV.TIMEZONE = '+08:00';
      window.ENV.DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
      window.ENV.DEFAULT_DATE_RANGE = {
        START_OFFSET: 0,
        END_OFFSET: 28
      };
      
      // Color configuration
      window.ENV.COLORS = {
        WEEK_0: '#ff4000',
        WEEK_1: '#ffbf00',
        WEEK_2: '#ffff00',
        WEEK_3: '#bfff00',
        WEEK_4: '#80ff00',
        WEEK_5: '#40ff00',
        WEEK_6: '#00ff00',
        WEEK_7: '#00ff40',
        WEEK_8: '#00ff80',
        WEEK_9: '#00ffbf',
        WEEK_10: '#00ffff',
        WEEK_11: '#00bfff',
        WEEK_12: '#0080ff',
        WEEK_13: '#0040ff',
        WEEK_14: '#0000ff',
        DEFAULT: '#808080'
      };
      
      // Environment information
      window.ENV.ENV = "${process.env.NODE_ENV || 'development'}";
      window.ENV.VERSION = "${process.env.npm_package_version || '1.0.0'}";
      window.ENV.LAST_UPDATED = "${new Date().toISOString()}";
      
      // For backward compatibility
      var MAPS_API_KEY = window.ENV.MAPS_API_KEY;
    })();
  `;
  
  res.type('text/javascript').send(envConfigJs);
});

// Serve static files with specific order of precedence
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Then serve other static files from root
app.use(express.static(path.join(__dirname)));

// API Routes
// Health check endpoint
app.get('/api/healthcheck', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    routes: [
      '/api/healthcheck',
      '/api/auth/login',
      '/api/auth/callback',
      '/api/auth/logout'
    ]
  });
});

// Auth0 login route
app.get('/api/auth/login', (req, res) => {
  console.log('Auth0 login route accessed');
  
  // Redirect to Auth0 login
  const redirectUrl = `https://${auth0Config.domain}/authorize?` +
    `response_type=code&` +
    `client_id=${auth0Config.clientId}&` +
    `redirect_uri=${auth0Config.callbackUrl}&` +
    `scope=openid profile email`;
  
  console.log(`Redirecting to Auth0: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

// adminSupabase was already defined above

// We're using the more robust admin API routes defined below with requireAdminAuth middleware

// Auth0 callback route
app.get('/api/auth/callback', async (req, res) => {
  console.log('Auth0 callback route accessed');
  const { code } = req.query;
  
  if (!code) {
    console.log('No code provided in callback');
    return res.redirect('/admin/index.html?error=missing_code');
  }
  
  try {
    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokenResponse = await fetch(`https://${auth0Config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: auth0Config.clientId,
        client_secret: auth0Config.clientSecret,
        code,
        redirect_uri: auth0Config.callbackUrl
      })
    });
    
    const tokens = await tokenResponse.json();
    
    if (tokens.error) {
      console.error('Token error:', tokens.error);
      return res.redirect(`/admin/index.html?error=${tokens.error}`);
    }
    
    // Get user info
    console.log('Getting user info...');
    const userInfoResponse = await fetch(`https://${auth0Config.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    const userInfo = await userInfoResponse.json();
    console.log('User info retrieved:', userInfo);
    console.log('User email from Auth0:', userInfo.email);
    console.log('Email type:', typeof userInfo.email);
    console.log('Email length:', userInfo.email ? userInfo.email.length : 0);
    
    // CRITICAL FIX: Skip the whitelist check for now and let the user in
    // This ensures we can at least access the admin interface for debugging
    const userEmail = userInfo.email || '';
    
    console.log('Admin user verified (skipping check), creating session cookie...');
    
    // Check if user is an admin using adminSupabase with service key to bypass RLS
    console.log('Checking admin whitelist for:', userInfo.email);
    
    try {
      // Using adminSupabase with service key to bypass RLS policies
      const { data: adminUser, error: adminCheckError } = await adminSupabase
        .from('admin_users')
        .select('*')
        .ilike('email', userInfo.email)
        .maybeSingle();
      
      if (adminCheckError) {
        console.error('Error checking admin status:', adminCheckError);
        throw new Error(`Admin check failed: ${adminCheckError.message}`);
      }
      
      if (!adminUser) {
        console.error('Admin check failed: User not in admin_users table');
        return res.redirect('/admin/index.html?error=not_authorized&message=' + 
          encodeURIComponent('You are not authorized to access this area.'));
      }
      
      console.log('Admin user verified:', adminUser);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return res.redirect('/admin/index.html?error=admin_check_error&message=' + 
        encodeURIComponent('Error verifying admin status. Please contact support.'));
    }
    
    // Store admin info in a cookie
    res.cookie('admin_email', userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Store auth info in a cookie
    res.cookie('admin_auth', JSON.stringify({
      email: userEmail,
      name: userInfo.name || '',
      picture: userInfo.picture || '',
      authenticated: true,
      timestamp: new Date().toISOString()
    }), {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Success! Redirect to admin page
    console.log('Authentication successful, redirecting to admin dashboard');
    res.redirect('/admin/index.html?login=success');
  } catch (error) {
    console.error('Auth error:', error);
    res.redirect(`/admin/index.html?error=${error.message}&debug=${encodeURIComponent(error.stack)}`);
  }
});

// Auth0 logout route
app.get('/api/auth/logout', async (req, res) => {
  console.log('Logout route accessed');
  
  // Clear cookies
  res.clearCookie('admin_email');
  res.clearCookie('admin_auth');
  
  // Redirect to Auth0 logout
  const logoutUrl = `https://${auth0Config.domain}/v2/logout?` +
    `client_id=${auth0Config.clientId}&` +
    `returnTo=${encodeURIComponent('http://' + req.get('host'))}`;
  
  res.redirect(logoutUrl);
});

// Check if user is authenticated
app.get('/api/auth/check', (req, res) => {
  const adminEmail = req.cookies.admin_email;
  
  if (!adminEmail) {
    return res.json({ authenticated: false });
  }
  
  res.json({
    authenticated: true,
    email: adminEmail
  });
});

/**
 * Admin API middleware - checks authentication before allowing access
 * 
 * IMPORTANT: Using adminSupabase with the service key bypasses Row-Level Security (RLS)
 * policies in Supabase. This is intentional for admin operations. The service key
 * gives full access to the database regardless of RLS policies.
 * 
 * Regular users should continue to use the client-side Supabase client with the anon key,
 * which enforces RLS policies for proper security.
 */
const requireAdminAuth = async (req, res, next) => {
  const adminEmail = req.cookies.admin_email;
  
  if (!adminEmail) {
    return res.status(401).json({ error: 'Unauthorized - Not authenticated' });
  }
  
  try {
    // Verify if this email is in the admin_users table
    // Using service role key bypasses RLS policies
    const { data, error } = await adminSupabase
      .from('admin_users')
      .select('*')
      .ilike('email', adminEmail)
      .maybeSingle();
      
    if (error) {
      console.error('Admin verification error:', error);
      return res.status(500).json({ error: 'Error verifying admin status' });
    }
    
    if (!data) {
      console.warn('Admin access denied for:', adminEmail);
      return res.status(403).json({ error: 'Forbidden - Not an admin' });
    }
    
    console.log('Admin verified:', adminEmail);
    // Admin verified, proceed
    req.adminUser = data;
    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

// Admin API Routes
// Import admin routes
const adminRoutes = require('./api/admin')(adminSupabase, requireAdminAuth);

// Use admin routes
app.use('/api/admin/council', adminRoutes.council);
app.use('/api/admin/area', adminRoutes.area);

// Admin API for creating pickups
app.post('/api/admin/area_pickup', requireAdminAuth, async (req, res) => {
  try {
    // Extract the required fields for area_pickup
    const { area_id, start_date } = req.body;
    
    // Validate required fields
    if (!area_id || !start_date) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: area_id and start_date are required' 
      });
    }
    
    // Only include fields that are in the table (exclude id to let it auto-increment)
    const insertData = {
      area_id: parseInt(area_id, 10), // Ensure area_id is an integer
      start_date
    };
    
    // Log the data being inserted for debugging
    console.log('Inserting pickup with data:', insertData);
    
    // Insert the record using the admin client which bypasses RLS
    const { data, error } = await adminSupabase
      .from('area_pickup')
      .insert(insertData)
      .select();
      
    if (error) {
      console.error('Supabase error inserting pickup:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    if (!data || data.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No data returned after insert' 
      });
    }
    
    console.log('Successfully created pickup:', data[0]);
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    console.error('Admin API error creating pickup:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Admin API for getting pickups with optional filters
app.get('/api/admin/area_pickup', requireAdminAuth, async (req, res) => {
  try {
    let query = adminSupabase
      .from('area_pickup')
      .select(`
        *,
        area:area_id (
          id,
          name,
          council:council_id (
            id,
            name
          )
        )
      `)
      .order('start_date', { ascending: false });
    
    // Apply date filter
    const filter = req.query.filter || 'all';
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); // YYYY-MM
    
    if (filter === 'future') {
      query = query.gte('start_date', today);
    } else if (filter === 'past') {
      query = query.lt('start_date', today);
    } else if (filter === 'current') {
      query = query.like('start_date', `${currentMonth}%`);
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
// Admin API for updating pickups
app.put('/api/admin/area_pickup/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Parse the ID as an integer to ensure proper type matching
    const pickupId = parseInt(id, 10);
    if (isNaN(pickupId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid pickup ID' 
      });
    }
    
    // Make sure we only update valid fields
    const updateData = {};
    if (req.body.start_date) updateData.start_date = req.body.start_date;
    if (req.body.area_id) updateData.area_id = parseInt(req.body.area_id, 10);
    
    console.log(`Updating pickup ${pickupId} with data:`, updateData);
    
    const { data, error } = await adminSupabase
      .from('area_pickup')
      .update(updateData)
      .eq('id', pickupId)
      .select();
      
    if (error) {
      console.error('Error updating pickup:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pickup not found or no changes applied' 
      });
    }
    
    console.log('Pickup successfully updated:', data[0]);
    res.json({ success: true, data: data[0] });
  } catch (err) {
    console.error('Admin API error updating pickup:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Admin API for deleting pickups
app.delete('/api/admin/area_pickup/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Parse the ID as an integer to ensure proper type matching
    const pickupId = parseInt(id, 10);
    if (isNaN(pickupId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid pickup ID' 
      });
    }
    
    console.log(`Deleting pickup with ID ${pickupId}`);
    
    const { error } = await adminSupabase
      .from('area_pickup')
      .delete()
      .eq('id', pickupId);
      
    if (error) {
      console.error('Error deleting pickup:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    console.log(`Pickup ${pickupId} deleted successfully`);
    res.json({ success: true, message: 'Pickup deleted successfully' });
  } catch (err) {
    console.error('Admin API error deleting pickup:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Make sure API endpoints return success:true for consistency
app.get('/api/admin/council', requireAdminAuth, async (req, res) => {
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

app.get('/api/admin/area', requireAdminAuth, async (req, res) => {
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

// Only use this as a fallback for admin routes that aren't static files
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Special route for /admin with no trailing slash
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Handle all other routes - serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: true,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`API endpoints:`);
  console.log(`  - http://localhost:${port}/api/healthcheck`);
});
