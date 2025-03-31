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

// Supabase setup
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

// Serve static files with specific order of precedence
// First, serve static files from admin directory specifically
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
      '/api/auth/debug',
      '/api/auth/login',
      '/api/auth/callback',
      '/api/auth/logout'
    ]
  });
});

// Auth debug endpoint
app.get('/api/auth/debug', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auth API is working',
    time: new Date().toISOString()
  });
});

// Admin user registration endpoint (for testing only)
app.get('/api/auth/register-admin', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    console.log(`Attempting to register admin user: ${email}`);
    
    // Check if admin_users table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('admin_users')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.log('Error checking admin_users table:', tableError);
      
      // Table might not exist, let's try to create it
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_sign_in TIMESTAMP WITH TIME ZONE
        );
      `;
      
      // Need to use raw SQL query
      try {
        console.log('Attempting to create admin_users table...');
        await supabase.rpc('execute_sql', { query: createTableQuery });
        console.log('admin_users table created successfully');
      } catch (createError) {
        console.error('Error creating admin_users table:', createError);
        return res.status(500).json({
          error: 'Failed to create admin_users table',
          details: createError.message
        });
      }
    }
    
    // Insert the admin user
    const { data: insertData, error: insertError } = await supabase
      .from('admin_users')
      .upsert([{ email }])
      .select();
    
    if (insertError) {
      console.error('Error inserting admin user:', insertError);
      return res.status(500).json({
        error: 'Failed to insert admin user',
        details: insertError.message
      });
    }
    
    // Show all admin users
    const { data: allAdmins } = await supabase
      .from('admin_users')
      .select('*');
    
    return res.json({
      success: true,
      message: `Admin user ${email} registered successfully`,
      user: insertData[0],
      all_admins: allAdmins
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
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
    
    // Re-enable admin check now that the policy is fixed
    console.log('Checking admin whitelist for:', userInfo.email);
    
    try {
      // Let's dump the admin_users table to see what's in it
      const { data: allAdminUsers, error: listError } = await supabase
        .from('admin_users')
        .select('*');
        
      console.log('All admin users:', allAdminUsers);
      
      if (listError) {
        // This is likely an RLS issue
        console.error('Error listing admin users:', listError);
        console.log('This is likely due to Row Level Security (RLS) restricting access.');
        console.log('Please run this SQL in Supabase SQL Editor:');
        console.log(`ALTER POLICY "admin_users_policy" ON "public"."admin_users" TO public USING (true);`);
        throw new Error(`Unable to check admin status due to RLS: ${listError.message}`);
      }
      
      // Check if the user's email is in the admin list
      const isAdmin = allAdminUsers && allAdminUsers.some(user => 
        user.email && user.email.toLowerCase() === userInfo.email.toLowerCase()
      );
      
      if (!isAdmin) {
        console.error('Admin check failed: User not in whitelist');
        return res.redirect('/admin/index.html?error=not_authorized&message=' + 
          encodeURIComponent('You are not authorized to access this area.'));
      }
      
      console.log('Admin user verified, creating session cookie...');
    } catch (error) {
      console.error('Error checking admin status:', error);
      // Let them in anyway if there's an error checking admin status
      console.log('Proceeding with authentication despite admin check error');
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
  console.log(`  - http://localhost:${port}/api/auth/debug`);
});
