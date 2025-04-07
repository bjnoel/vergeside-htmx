// This script fetches configuration from the /api/config endpoint
// and makes it available under window.ENV

(function() {
    // Define the window.ENV object and a promise for loading status
    window.ENV = window.ENV || {};
    let resolveConfigPromise;
    window.ENV.configLoaded = new Promise(resolve => {
        resolveConfigPromise = resolve;
    });
    window.ENV.isConfigLoaded = false;

    async function fetchConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.statusText}`);
            }
            const config = await response.json();

            // Assign fetched config to window.ENV
            Object.assign(window.ENV, config);

            // --- Backward compatibility / Global variables (Optional but present in original) ---
            // Set Mapbox token globally if needed by libraries loaded before config is fetched
            // Note: Mapbox GL JS might need the token set *before* map initialization.
            // Consider initializing Mapbox *after* config is loaded.
            if (window.ENV.MAPBOX_TOKEN) {
                 window.MAPBOX_TOKEN = window.ENV.MAPBOX_TOKEN; // For potential legacy use or direct library access
                 if (typeof mapboxgl !== 'undefined') {
                     console.log("Setting mapboxgl.accessToken from fetched config.");
                     mapboxgl.accessToken = window.ENV.MAPBOX_TOKEN;
                 }
            }
             // Keep other legacy vars if needed
             if (window.ENV.MAPS_API_KEY) {
                 var MAPS_API_KEY = window.ENV.MAPS_API_KEY;
             }
            // --- End Backward compatibility ---

            console.log('Client configuration loaded successfully:', window.ENV);
            window.ENV.isConfigLoaded = true;
            resolveConfigPromise(true); // Resolve the promise indicating config is ready

        } catch (error) {
            console.error('Failed to load client configuration:', error);
            window.ENV.isConfigLoaded = false;
            // Optionally display an error message to the user
            // document.body.innerHTML = '<div class="alert alert-danger">Failed to load application configuration. Please try again later.</div>';
            resolveConfigPromise(false); // Resolve with false on error
        }
    }

    // Fetch the configuration immediately
    fetchConfig();

})();
