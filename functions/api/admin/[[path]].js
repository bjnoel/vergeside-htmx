import { createClient } from '@supabase/supabase-js';
// TODO: Import necessary Auth0 validation libraries (e.g., jose or auth0 SDK)

// --- Reusable Auth0 JWT Validation ---
// Needs AUTH0_DOMAIN and AUTH0_AUDIENCE from environment variables
async function validateAuth0Token(request) {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Missing or invalid Authorization header', status: 401 };
    }
    const token = authorizationHeader.substring(7); // Remove 'Bearer ' prefix

    // --- Placeholder for actual JWT validation ---
    // Use jose, auth0 SDK, or similar to verify the token against Auth0 JWKS endpoint
    // Example using a hypothetical library:
    /*
    try {
        const { payload } = await jwtVerify(token, getJwksUri(process.env.AUTH0_DOMAIN), {
            issuer: `https://${process.env.AUTH0_DOMAIN}/`,
            audience: process.env.AUTH0_AUDIENCE,
            algorithms: ['RS256']
        });
        // Optional: Check if user email from payload exists in Supabase admin_users table
        // const userEmail = payload.email; // Adjust based on actual payload structure
        // const isAdmin = await checkAdminSupabase(userEmail, context.env);
        // if (!isAdmin) return { valid: false, error: 'User not authorized as admin', status: 403 };

        return { valid: true, payload };
    } catch (err) {
        console.error("Auth0 validation error:", err);
        return { valid: false, error: `Token validation failed: ${err.message}`, status: 401 };
    }
    */
    // --- End Placeholder ---

    // TEMPORARY: Allow access for now until validation is implemented
    console.warn("Auth0 token validation is currently bypassed!");
    if (token) { // Basic check if token exists
         return { valid: true, payload: { sub: 'temp-user', email: 'temp@example.com' } }; // Dummy payload
    } else {
         return { valid: false, error: 'Missing token (validation bypassed)', status: 401 };
    }
}

// --- Reusable Supabase Admin Client ---
function getAdminSupabaseClient(env) {
    // Ensure env vars are set in Cloudflare Pages settings
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase environment variables");
        throw new Error("Server configuration error: Supabase credentials missing.");
    }
    // Create and return the Supabase client
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- Main Request Handler ---
export async function onRequest(context) {
    const { request, env, params } = context;
    const method = request.method;
    const url = new URL(request.url);
    const pathSegments = params.path || []; // [[path]] gives an array of segments

    // --- Authentication Check ---
    const authResult = await validateAuth0Token(request);
    if (!authResult.valid) {
        return new Response(JSON.stringify({ success: false, error: authResult.error }), {
            status: authResult.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    // TODO: Use authResult.payload if needed (e.g., user email for logging)

    // --- Initialize Supabase Admin Client ---
    let adminSupabase;
    try {
        adminSupabase = getAdminSupabaseClient(env);
    } catch (error) {
         return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // --- API Routing ---
    const resource = pathSegments[0]; // e.g., 'council', 'area', 'area_polygon', 'area_pickup'
    const id = pathSegments[1];       // e.g., the ID for PUT/DELETE

    try {
        // Placeholder for routing logic
        console.log(`Admin API request: ${method} /api/admin/${pathSegments.join('/')}`);

        if (resource === 'council') {
            // TODO: Migrate logic from api/admin/council.js
            if (method === 'GET') {
                 const { data, error } = await adminSupabase.from('council').select('*').order('name');
                 if (error) throw error;
                 return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
            }
            // TODO: Add POST/PUT/DELETE if needed
        }
        else if (resource === 'area') {
            // TODO: Migrate logic from api/admin/area.js
             if (method === 'GET') {
                let query = adminSupabase.from('area').select('*, council:council_id (id, name)').order('name');
                const councilId = url.searchParams.get('council_id');
                if (councilId) query = query.eq('council_id', councilId);
                const { data, error } = await query;
                if (error) throw error;
                return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
            }
             // TODO: Add POST/PUT/DELETE if needed
        }
        else if (resource === 'area_polygon') {
             // TODO: Migrate logic from api/admin/area_polygon_routes.js and api/admin/area_polygon.js
             if (method === 'GET') {
                 let query = adminSupabase.from('area_polygon').select('*');
                 const areaId = url.searchParams.get('area_id');
                 if (areaId) query = query.eq('area_id', areaId);
                 // Handle specific polygon ID if present (e.g., /api/admin/area_polygon/123)
                 if (id) query = query.eq('id', id).maybeSingle();

                 const { data, error } = await query;
                 if (error) throw error;
                 if (id && !data) return new Response(JSON.stringify({ success: false, error: 'Polygon not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                 return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
             }
             else if (method === 'POST') {
                 const body = await request.json();
                 const { area_id, active, coordinates } = body;
                 if (!area_id || !coordinates) return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400 });
                 const { data, error } = await adminSupabase.from('area_polygon').insert({ area_id, active, coordinates }).select();
                 if (error) throw error;
                 return new Response(JSON.stringify({ success: true, data: data[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
             }
             else if (method === 'PUT' && id) {
                 const body = await request.json();
                 const updateData = {};
                 if (body.hasOwnProperty('active')) updateData.active = body.active;
                 if (body.coordinates) updateData.coordinates = body.coordinates;
                 const { data, error } = await adminSupabase.from('area_polygon').update(updateData).eq('id', id).select();
                 if (error) throw error;
                 if (!data || data.length === 0) return new Response(JSON.stringify({ success: false, error: 'Polygon not found' }), { status: 404 });
                 return new Response(JSON.stringify({ success: true, data: data[0] }), { headers: { 'Content-Type': 'application/json' } });
             }
             else if (method === 'DELETE' && id) {
                 const { error } = await adminSupabase.from('area_polygon').delete().eq('id', id);
                 if (error) throw error;
                 return new Response(JSON.stringify({ success: true, message: 'Polygon deleted' }), { headers: { 'Content-Type': 'application/json' } });
             }
        }
         else if (resource === 'area_pickup') {
             // TODO: Migrate logic from server.js
             if (method === 'GET') {
                 let query = adminSupabase.from('area_pickup').select('*, area:area_id (id, name, council:council_id (id, name))').order('start_date', { ascending: false });
                 // TODO: Add filtering logic from server.js if needed
                 const { data, error } = await query;
                 if (error) throw error;
                 return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
             }
             else if (method === 'POST') {
                 const body = await request.json();
                 const { area_id, start_date } = body;
                 if (!area_id || !start_date) return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400 });
                 const { data, error } = await adminSupabase.from('area_pickup').insert({ area_id: parseInt(area_id, 10), start_date }).select();
                 if (error) throw error;
                 return new Response(JSON.stringify({ success: true, data: data[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
             }
             else if (method === 'PUT' && id) {
                 const body = await request.json();
                 const updateData = {};
                 if (body.start_date) updateData.start_date = body.start_date;
                 if (body.area_id) updateData.area_id = parseInt(body.area_id, 10);
                 const { data, error } = await adminSupabase.from('area_pickup').update(updateData).eq('id', id).select();
                 if (error) throw error;
                 if (!data || data.length === 0) return new Response(JSON.stringify({ success: false, error: 'Pickup not found' }), { status: 404 });
                 return new Response(JSON.stringify({ success: true, data: data[0] }), { headers: { 'Content-Type': 'application/json' } });
             }
             else if (method === 'DELETE' && id) {
                 const { error } = await adminSupabase.from('area_pickup').delete().eq('id', id);
                 if (error) throw error;
                 return new Response(JSON.stringify({ success: true, message: 'Pickup deleted' }), { headers: { 'Content-Type': 'application/json' } });
             }
         }

        // Fallback for unhandled routes within /api/admin
        return new Response(JSON.stringify({ success: false, error: 'Admin route not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(`Admin API Error (${method} /api/admin/${pathSegments.join('/')}):`, error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Internal Server Error' }), {
            status: (error.status || 500), // Use Supabase error status if available
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
