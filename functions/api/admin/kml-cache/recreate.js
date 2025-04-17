// Admin API endpoint to recreate KML cache table

export async function onRequest(context) {
  try {
    // Allow CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Check if this is a POST request
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed' 
      }), {
        status: 405,
        headers
      });
    }

    // Verify auth token from admin-auth.js
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - missing or invalid auth token' 
      }), {
        status: 401,
        headers
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token with Auth0
    // This is simplified for the example - in a real implementation, 
    // verify the token with Auth0's API
    if (!token) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - invalid token' 
      }), {
        status: 401,
        headers
      });
    }

    // Create Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // SQL to create KML cache table if it doesn't exist
    const sql = `
      -- Recreate KML cache table if it doesn't exist
      CREATE TABLE IF NOT EXISTS public.kml_cache (
          id SERIAL PRIMARY KEY,
          cache_key TEXT UNIQUE NOT NULL,
          kml_content TEXT NOT NULL,
          parameters JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp
      );

      -- Add index on cache_key for faster lookups
      CREATE INDEX IF NOT EXISTS kml_cache_cache_key_idx ON public.kml_cache (cache_key);

      -- Add expiry index on created_at to make cleaning up old entries easier
      CREATE INDEX IF NOT EXISTS kml_cache_created_at_idx ON public.kml_cache (created_at);

      -- Grant access to the anon role (to match existing permissions)
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.kml_cache TO anon;
      GRANT USAGE, SELECT ON SEQUENCE public.kml_cache_id_seq TO anon;
    `;

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      return new Response(JSON.stringify({ 
        error: 'Database error',
        details: error.message 
      }), {
        status: 500,
        headers,
      });
    }

    // Check if kml_cache table now exists
    const { error: checkError } = await supabase
      .from('kml_cache')
      .select('*', { count: 'exact', head: true });

    if (checkError) {
      return new Response(JSON.stringify({ 
        error: 'Failed to verify KML cache table creation',
        details: checkError.message 
      }), {
        status: 500,
        headers,
      });
    }

    // Record the event in a system log if it exists
    try {
      await supabase
        .from('system_log')
        .insert([{
          action: 'kml_cache_recreate',
          performed_by: 'admin', // You could extract user info from token
          details: 'KML cache table recreated via admin maintenance',
          timestamp: new Date().toISOString()
        }]);
    } catch (logError) {
      // Don't fail the operation if logging fails
      console.error('Failed to log KML cache recreation:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'KML cache table recreated successfully'
    }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Server error',
      details: err.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// Handle OPTIONS request for CORS
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
