// Health check endpoint to verify server is working
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
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

module.exports = router;
