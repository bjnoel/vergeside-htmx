// Admin-only endpoint to recreate the KML cache table

export async function onRequest(context) {
  try {
    // Allow CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Check for basic auth token for admin access
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          ...headers,
          'WWW-Authenticate': 'Basic realm="Admin Access"',
        },
      });
    }

    // Verify admin credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    // This is a simple admin check - replace with your actual admin validation
    if (username !== context.env.ADMIN_USERNAME || password !== context.env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers,
      });
    }

    // Get the SQL file content
    const kmlCacheSql = await context.env.ASSETS.fetch(
      new URL('/functions/api/recreate-kml-cache.sql', context.request.url)
    ).then(res => res.text());

    // Create Supabase client with the service role key
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: kmlCacheSql });

    if (error) {
      return new Response(JSON.stringify({ 
        error: 'Database error',
        details: error.message 
      }), {
        status: 500,
        headers,
      });
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
