// Admin API endpoint to clear KML cache

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

    // First, check if the kml_cache table exists
    let entriesCleared = 0;
    try {
      const { count, error: checkError } = await supabase
        .from('kml_cache')
        .select('*', { count: 'exact', head: true });

      if (checkError) {
        if (checkError.code === '42P01') { // Table doesn't exist error code
          return new Response(JSON.stringify({ 
            error: 'KML cache table does not exist',
            details: 'The table needs to be created first before it can be cleared'
          }), {
            status: 404,
            headers
          });
        } else {
          return new Response(JSON.stringify({ 
            error: 'Database error',
            details: checkError.message 
          }), {
            status: 500,
            headers
          });
        }
      }

      entriesCleared = count || 0;
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Error checking KML cache table',
        details: e.message 
      }), {
        status: 500,
        headers
      });
    }

    // Delete all entries from the kml_cache table
    const { error } = await supabase
      .from('kml_cache')
      .delete()
      .neq('id', 0); // This ensures all records are deleted

    if (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to clear KML cache',
        details: error.message 
      }), {
        status: 500,
        headers
      });
    }

    // Record the event in a system log if it exists
    try {
      await supabase
        .from('system_log')
        .insert([{
          action: 'kml_cache_clear',
          performed_by: 'admin', // You could extract user info from token
          details: `KML cache cleared via admin maintenance. ${entriesCleared} entries removed.`,
          timestamp: new Date().toISOString()
        }]);
    } catch (logError) {
      // Don't fail the operation if logging fails
      console.error('Failed to log KML cache clearing:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `KML cache cleared successfully. ${entriesCleared} entries removed.`,
      entriesCleared
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
