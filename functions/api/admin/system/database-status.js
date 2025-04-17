// Admin API endpoint to check database connection status

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

    // Test database connection with a simple query
    const { data, error } = await supabase.rpc('get_current_timestamp');

    if (error) {
      return new Response(JSON.stringify({ 
        status: 'error',
        connected: false,
        message: 'Database connection failed',
        details: error.message 
      }), {
        status: 500,
        headers
      });
    }

    // Success - connection is working
    return new Response(JSON.stringify({
      status: 'success',
      connected: true,
      message: 'Database connection successful',
      timestamp: data
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
