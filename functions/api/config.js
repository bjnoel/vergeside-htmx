// This function provides client-safe configuration variables
// It reads from the environment context (populated by .dev.vars locally or Cloudflare env vars in production)

export async function onRequest(context) {
    const { env } = context;

    // Define which environment variables are safe to expose to the client
    const clientConfig = {
        MAPBOX_TOKEN: env.MAPBOX_TOKEN || '', // Public Mapbox token
        SUPABASE_URL: env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '',
        // Add other client-safe variables here if needed
        // e.g., AUTH0_DOMAIN, AUTH0_CLIENT_ID for the Auth0 SPA SDK if you were using it directly
    };

    // Basic check if essential keys are missing (optional, but good practice)
    if (!clientConfig.MAPBOX_TOKEN || !clientConfig.SUPABASE_URL || !clientConfig.SUPABASE_ANON_KEY) {
         console.warn("One or more client configuration variables are missing from the environment.");
         // Depending on requirements, you might return an error or just the available config
    }

    return new Response(JSON.stringify(clientConfig), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=60' // Cache for 1 minute, adjust as needed
        },
    });
}
