// This script injects environment variables from Cloudflare Pages
// Values will be replaced during build/deploy time
// The 'MAPS_API_KEY' global variable will be available to config.js

// Using Cloudflare Pages standard patterns
// Define the window.ENV object to store environment variables
window.ENV = window.ENV || {};

// Set the MAPS_API_KEY with a fallback pattern
window.ENV.MAPS_API_KEY = '${MAPS_API_KEY}';
// Replace placeholder pattern if it wasn't injected
if (window.ENV.MAPS_API_KEY === '${MAPS_API_KEY}') {
    window.ENV.MAPS_API_KEY = '';
}

// For backward compatibility
var MAPS_API_KEY = window.ENV.MAPS_API_KEY;
