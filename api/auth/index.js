// Auth API handlers
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wihegqwakwwvckxrivem.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGVncXdha3d3dmNreHJpdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2Mzg1NDksImV4cCI6MjA1NjIxNDU0OX0.aP2ThYybxtUE6JaVHs1sowZaDfAbxxPC_yBotY5qApM';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'your-auth0-domain.auth0.com';
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || 'your-auth0-client-id';
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET || 'your-auth0-client-secret';
const AUTH0_CALLBACK_URL = process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/api/auth/callback';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create router
const router = express.Router();

// Import debug router
const debugRouter = require('./debug');

// Use debug router
router.use('/debug', debugRouter);

// Login route
router.get('/login', (req, res) => {
  console.log('Login route accessed');
  // Redirect to Auth0 login
  const redirectUrl = `https://${AUTH0_DOMAIN}/authorize?` +
    `response_type=code&` +
    `client_id=${AUTH0_CLIENT_ID}&` +
    `redirect_uri=${AUTH0_CALLBACK_URL}&` +
    `scope=openid profile email`;
    
  res.redirect(redirectUrl);
});

// Callback route
router.get('/callback', async (req, res) => {
  console.log('Callback route accessed');
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('/admin/index.html?error=missing_code');
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: AUTH0_CALLBACK_URL
      })
    });
    
    const tokens = await tokenResponse.json();
    
    if (tokens.error) {
      console.error('Token error:', tokens.error);
      return res.redirect(`/admin/index.html?error=${tokens.error}`);
    }
    
    // Get user info
    const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    const userInfo = await userInfoResponse.json();
    console.log('User info retrieved:', userInfo.email);
    
    // Create a session with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'auth0',
      token: tokens.id_token,
      nonce: 'NONCE', // You should generate a proper nonce
    });
    
    if (error) {
      console.error('Supabase auth error:', error);
      return res.redirect(`/admin/index.html?error=${error.message}`);
    }
    
    // Success! Redirect to admin page
    res.redirect('/admin/index.html');
  } catch (error) {
    console.error('Auth error:', error);
    res.redirect(`/admin/index.html?error=${error.message}`);
  }
});

// Logout route
router.get('/logout', async (req, res) => {
  console.log('Logout route accessed');
  // Sign out from Supabase
  await supabase.auth.signOut();
  
  // Redirect to Auth0 logout
  const logoutUrl = `https://${AUTH0_DOMAIN}/v2/logout?` +
    `client_id=${AUTH0_CLIENT_ID}&` +
    `returnTo=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`;
    
  res.redirect(logoutUrl);
});

module.exports = router;
