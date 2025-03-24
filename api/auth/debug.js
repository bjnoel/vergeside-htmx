// Debug route for checking if auth API is working
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auth API is working',
    time: new Date().toISOString()
  });
});

module.exports = router;
