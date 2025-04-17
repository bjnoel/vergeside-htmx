// Admin API endpoint to check KML cache status

export async function onRequest(context) {
  try {
    // Allow CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

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
    // Here you would typically validate the token with Auth0
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

    // Check if kml_cache table exists and get count
    let count = 0;
    let lastEntry = null;
    let available = false;
    let error = null;

    try {
      // Check if the table exists
      const { count: tableCount, error: tableError } = await supabase
        .from('kml_cache')
        .select('*', { count: 'exact', head: true });

      if (tableError) {
        if (tableError.code === '42P01') { // Table doesn't exist error code
          available = false;
          error = 'KML cache table does not exist';
        } else {
          available = false;
          error = tableError.message;
        }
      } else {
        available = true;
        count = tableCount || 0;

        // Get the most recent entry
        if (count > 0) {
          const { data: lastEntryData, error: lastEntryError } = await supabase
            .from('kml_cache')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!lastEntryError && lastEntryData) {
            lastEntry = lastEntryData.created_at;
          }
        }
      }
    } catch (e) {
      available = false;
      error = e.message;
    }

    return new Response(JSON.stringify({
      available,
      count,
      lastEntry,
      error
    }), {
      status: 200,
      headers
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
