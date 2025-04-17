// Admin API endpoint to get the timestamp of the last KML cache reset

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

    // Try to get the last reset time from system_log
    let lastReset = null;
    try {
      const { data, error } = await supabase
        .from('system_log')
        .select('timestamp')
        .eq('action', 'kml_cache_clear')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
        
      if (!error && data) {
        lastReset = data.timestamp;
      }
    } catch (e) {
      // Table might not exist, or other error - don't fail the whole operation
      console.error('Error checking system_log:', e);
    }

    // If no log entry was found, try to get the oldest kml_cache entry
    if (!lastReset) {
      try {
        const { data, error } = await supabase
          .from('kml_cache')
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
          
        if (!error && data) {
          // The earliest entry timestamp might be after the last clearing
          lastReset = data.created_at;
        }
      } catch (e) {
        // Table might not exist, or other error - don't fail the whole operation
        console.error('Error checking kml_cache earliest entry:', e);
      }
    }

    return new Response(JSON.stringify({
      lastReset
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
