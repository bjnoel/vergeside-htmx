import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose'; // Import jose

// --- Reusable Auth0 JWT Validation ---
// Needs AUTH0_DOMAIN and AUTH0_AUDIENCE from environment variables
async function validateAuth0Token(request, env) { // Added env parameter
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Missing or invalid Authorization header', status: 401 };
    }
    const token = authorizationHeader.substring(7); // Remove 'Bearer ' prefix
    console.log("Backend: Received token string:", token); // Log raw token string

    const auth0Domain = env.AUTH0_DOMAIN;
    const auth0Audience = env.AUTH0_AUDIENCE;

    if (!auth0Domain || !auth0Audience) {
        console.error("Auth0 domain or audience missing from environment variables.");
        return { valid: false, error: 'Server configuration error for Auth0', status: 500 };
    }

    // --- Conditional Validation ---
    // Bypass JWT validation locally for easier testing due to CryptoKey issues with Wrangler/jose
    if (env.NODE_ENV !== 'production') {
        console.warn("Auth0 token validation is BYPASSED for local development!");
        if (token) { // Basic check if token exists
            return { valid: true, payload: { sub: 'temp-local-user', email: 'local@example.com' } }; // Dummy payload
        } else {
            return { valid: false, error: 'Missing token (validation bypassed)', status: 401 };
        }
    }
    // --- End Local Bypass ---

    // --- Production JWT Validation ---
    console.log("Attempting production JWT validation...");
    const JWKS = jose.createRemoteJWKSet(new URL(`https://${auth0Domain}/.well-known/jwks.json`)); // Use standard remote set for production

    // --- Manual JWKS Fetch and Key Import --- // Keep reverted code commented out
    // let jwk; // Declare jwk outside the try block // Reverted
    /* // Reverted manual fetch logic
    try {
        // 1. Fetch the JWKS
        const jwksUrl = new URL(`https://${auth0Domain}/.well-known/jwks.json`);
        const response = await fetch(jwksUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
        }
        const jwks = await response.json();

        // 2. Decode the token header to find the Key ID (kid)
        const protectedHeader = jose.decodeProtectedHeader(token);
        const kid = protectedHeader?.kid;
        if (!kid) {
            throw new Error("Token header missing 'kid'");
        }

        // 3. Find the matching key in the JWKS and assign to outer variable
        jwk = jwks.keys?.find(k => k.kid === kid); // Assign to outer jwk
        if (!jwk) {
            throw new Error(`No matching key found in JWKS for kid: ${kid}`);
        }

        // 4. We have the matching JWK object (jwk), don't import it here
        // key = await jose.importJWK(jwk, protectedHeader.alg); // Removed import step
        // console.log('JWK found:', jwk); // Optional: log the found JWK

    } catch (fetchError) {
         console.error("Error fetching JWK:", fetchError);
         return { valid: false, error: `Failed to retrieve signing key: ${fetchError.message}`, status: 500 };
    }
    */ // Reverted manual fetch logic
    // --- End Manual JWKS Fetch ---

    // Ensure jwk was found before proceeding // Reverted
    // if (!jwk) {
    //      return { valid: false, error: 'Failed to find appropriate signing key.', status: 500 };
    // }

    try {
        // 5. Verify the token using the remote JWKS
        const { payload } = await jose.jwtVerify(token, JWKS, { // Use JWKS again
            issuer: `https://${auth0Domain}/`,
            audience: auth0Audience,
            algorithms: ['RS256'] // Auth0 typically uses RS256
        });

        // Token is valid
        console.log('Auth0 token validated successfully for sub:', payload.sub);
        // You can optionally add further checks here, e.g., check against admin_users table if needed,
        // although the presence of a valid token for the correct audience might be sufficient authorization.
        // const userEmail = payload.email; // Adjust based on actual payload structure if needed

        return { valid: true, payload };
    } catch (err) {
        console.error("Auth0 validation error:", err.message);
        // Provide more specific error messages based on jose error codes if desired
        if (err.code === 'ERR_JWT_EXPIRED') {
             return { valid: false, error: 'Token expired', status: 401 };
        } else if (err.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || err.code === 'ERR_JWKS_NO_MATCHING_KEY') {
             return { valid: false, error: 'Invalid token signature', status: 401 };
        } else if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
             return { valid: false, error: `Token claim validation failed: ${err.message}`, status: 401 };
        }
        // Log the specific error code for debugging unknown errors
        return { valid: false, error: `Token validation failed: ${err.message} (Code: ${err.code})`, status: 401 };
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
    const authResult = await validateAuth0Token(request, env); // Pass env
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
                // If ID is provided, get specific council
                if (id) {
                    const councilId = parseInt(id, 10);
                    if (isNaN(councilId)) {
                        return new Response(JSON.stringify({ success: false, error: 'Invalid council ID' }), { 
                            status: 400,
                            headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    const { data, error } = await adminSupabase
                        .from('council')
                        .select('*')
                        .eq('id', councilId)
                        .single();
                    
                    if (error) {
                        return new Response(JSON.stringify({ success: false, error: error.message }), { 
                            status: 400,
                            headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    if (!data) {
                        return new Response(JSON.stringify({ success: false, error: 'Council not found' }), { 
                            status: 404,
                            headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    return new Response(JSON.stringify({ success: true, data }), { 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                } else {
                    // Get all councils
                    const { data, error } = await adminSupabase.from('council').select('*').order('name');
                    if (error) throw error;
                    return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
                }
            }
            // TODO: Add POST/PUT/DELETE if needed
        }
        else if (resource === 'area') {
            // TODO: Migrate logic from api/admin/area.js
             if (method === 'GET') {
                let query = adminSupabase.from('area').select('*, council:council_id (id, name)');

                // Filter by council if requested (for list view)
                const councilId = url.searchParams.get('council_id');
                if (councilId) {
                    query = query.eq('council_id', councilId).order('name');
                }
                // Filter by specific ID if present (for detail view)
                else if (id) {
                     query = query.eq('id', id).maybeSingle(); // Use maybeSingle() for single record
                }
                 // Default order if fetching all
                 else {
                     query = query.order('name');
                 }

                const { data, error } = await query;
                if (error) throw error;
                // Handle case where single record is requested but not found
                if (id && !data) {
                     return new Response(JSON.stringify({ success: false, error: 'Area not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }
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
                 // If ID is provided, get specific pickup
                 if (id) {
                     const pickupId = parseInt(id, 10);
                     if (isNaN(pickupId)) {
                         return new Response(JSON.stringify({ success: false, error: 'Invalid pickup ID' }), { 
                             status: 400,
                             headers: { 'Content-Type': 'application/json' } 
                         });
                     }
                     
                     const { data, error } = await adminSupabase
                         .from('area_pickup')
                         .select('*, area:area_id (id, name, council:council_id (id, name))')
                         .eq('id', pickupId)
                         .single();
                     
                     if (error) {
                         return new Response(JSON.stringify({ success: false, error: error.message }), { 
                             status: 400,
                             headers: { 'Content-Type': 'application/json' } 
                         });
                     }
                     
                     if (!data) {
                         return new Response(JSON.stringify({ success: false, error: 'Pickup not found' }), { 
                             status: 404,
                             headers: { 'Content-Type': 'application/json' } 
                         });
                     }
                     
                     return new Response(JSON.stringify({ success: true, data }), { 
                         headers: { 'Content-Type': 'application/json' } 
                     });
                 } else {
                     // Get all pickups with filtering
                     let query = adminSupabase.from('area_pickup').select('*, area:area_id (id, name, council:council_id (id, name))').order('start_date', { ascending: false });

                     // Implement filtering logic based on query parameter
                     const filter = url.searchParams.get('filter') || 'all';
                     const today = new Date().toISOString().split('T')[0];
                     const currentMonth = today.substring(0, 7); // YYYY-MM

                     if (filter === 'future') {
                         query = query.gte('start_date', today);
                     } else if (filter === 'past') {
                         query = query.lt('start_date', today);
                     } else if (filter === 'current') {
                         query = query.like('start_date', `${currentMonth}%`);
                     }
                     // 'all' filter needs no additional date filtering

                     const { data, error } = await query;
                     if (error) throw error;
                     return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
                 }
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
