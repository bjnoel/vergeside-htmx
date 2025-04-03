// This script injects environment variables from Cloudflare Pages or direct setting

// Define the window.ENV object to store environment variables
window.ENV = window.ENV || {};

// Set the MAPBOX_TOKEN from environment variables in Cloudflare
// ${MAPBOX_TOKEN} will be replaced with the actual value when deployed
window.ENV.MAPBOX_TOKEN = '${MAPBOX_TOKEN}';

// If running in Cloudflare Pages, this will be replaced
// Otherwise, check if we already have a token set in the window
if (window.ENV.MAPBOX_TOKEN === '${MAPBOX_TOKEN}') {
    // Fall back to any token set directly in the HTML
    if (!window.MAPBOX_TOKEN) {
        window.MAPBOX_TOKEN = '';
    }
    window.ENV.MAPBOX_TOKEN = window.MAPBOX_TOKEN || '';
} else {
    // We're in production and got a token from environment variables
    // Update the global variable
    window.MAPBOX_TOKEN = window.ENV.MAPBOX_TOKEN;
}

// Set the token for Mapbox GL if it's loaded and we have a token
if (typeof mapboxgl !== 'undefined' && window.MAPBOX_TOKEN) {
    mapboxgl.accessToken = window.MAPBOX_TOKEN;
}
