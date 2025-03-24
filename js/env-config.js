// This script injects environment variables from Cloudflare Pages
// Values will be replaced during build/deploy time
// The 'MAPS_API_KEY' global variable will be available to config.js

// Using Cloudflare Pages standard patterns
var MAPS_API_KEY = '${MAPS_API_KEY}';
