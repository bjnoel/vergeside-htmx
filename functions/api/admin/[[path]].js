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

        if (resource === 'stats' && method === 'GET') {
            const [councilResult, areaResult, pickupResult] = await Promise.all([
                adminSupabase.from('council').select('*', { count: 'exact', head: true }),
                adminSupabase.from('area').select('*', { count: 'exact', head: true }),
                adminSupabase.from('area_pickup').select('*', { count: 'exact', head: true }),
            ]);

            return new Response(JSON.stringify({
                success: true,
                data: {
                    councils: councilResult.count || 0,
                    areas: areaResult.count || 0,
                    pickups: pickupResult.count || 0,
                }
            }), { headers: { 'Content-Type': 'application/json' } });
        }
        else if (resource === 'council') {
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
            else if (method === 'POST') {
                const body = await request.json();
                const { name, council_url, bulk_waste_url, has_pickups, has_maps, date_last_checked } = body;
                
                // Validate required fields
                if (!name) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: name' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                if (!council_url) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: council_url' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                // Prepare the insert data
                const insertData = {
                    name,
                    council_url,
                    bulk_waste_url: bulk_waste_url || null,
                    has_pickups: has_pickups !== undefined ? has_pickups : true,
                    has_maps: has_maps !== undefined ? has_maps : false,
                    date_last_checked: date_last_checked || null
                };
                
                const { data, error } = await adminSupabase
                    .from('council')
                    .insert(insertData)
                    .select();
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                if (!data || data.length === 0) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'No data returned after insert' 
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
                
                return new Response(JSON.stringify({ success: true, data: data[0] }), { 
                    status: 201, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'PUT' && id) {
                const councilId = parseInt(id, 10);
                if (isNaN(councilId)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid council ID' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const body = await request.json();
                const { name, council_url, bulk_waste_url, has_pickups, has_maps, date_last_checked } = body;
                
                // Validate required fields
                if (!name) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: name' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                if (!council_url) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: council_url' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                // Prepare the update data
                const updateData = {
                    name,
                    council_url,
                    bulk_waste_url: bulk_waste_url || null,
                    has_pickups: has_pickups !== undefined ? has_pickups : true,
                    has_maps: has_maps !== undefined ? has_maps : false
                };
                
                // Only include date_last_checked if it's provided
                if (date_last_checked !== undefined) {
                    updateData.date_last_checked = date_last_checked;
                }
                
                const { data, error } = await adminSupabase
                    .from('council')
                    .update(updateData)
                    .eq('id', councilId)
                    .select();
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                if (!data || data.length === 0) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Council not found or no changes applied' 
                    }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }
                
                return new Response(JSON.stringify({ success: true, data: data[0] }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'DELETE' && id) {
                const councilId = parseInt(id, 10);
                if (isNaN(councilId)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid council ID' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const { error } = await adminSupabase
                    .from('council')
                    .delete()
                    .eq('id', councilId);
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ success: true, message: 'Council deleted successfully' }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        }
        else if (resource === 'area') {
            const subAction = pathSegments[2]; // e.g., 'generate-map', 'upload-map'

            // --- Bulk map status: GET /api/admin/area/map-status-bulk ---
            if (id === 'map-status-bulk' && method === 'GET') {
                const { data: files, error } = await adminSupabase.storage
                    .from('area-maps')
                    .list('', { limit: 1000 });

                if (error) throw error;

                const imageMap = {};
                (files || []).forEach(f => {
                    const match = f.name.match(/^(\d+)\.png$/);
                    if (match) imageMap[match[1]] = true;
                });

                return new Response(JSON.stringify({ success: true, data: imageMap }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // --- Generate map image: POST /api/admin/area/:id/generate-map ---
            if (subAction === 'generate-map' && method === 'POST' && id) {
              try {
                const areaId = parseInt(id, 10);
                if (isNaN(areaId)) {
                    return new Response(JSON.stringify({ success: false, error: 'Invalid area ID' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Fetch active polygons for this area
                const { data: polygons, error: polyError } = await adminSupabase
                    .from('area_polygon')
                    .select('coordinates')
                    .eq('area_id', areaId)
                    .eq('active', true);

                if (polyError) {
                    return new Response(JSON.stringify({ success: false, error: `DB error: ${polyError.message}` }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                if (!polygons || polygons.length === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'No active polygons found for this area' }), {
                        status: 404, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Convert coordinates to GeoJSON (matches logic in js/mapbox-controller.js:204-238)
                function parseCoordinates(coordinateString) {
                    let ring;
                    try {
                        const jsonPaths = JSON.parse(coordinateString);
                        ring = jsonPaths.map(coord => [coord.lng, coord.lat]);
                    } catch (e) {
                        // KML format: "lng,lat,alt lng,lat,alt ..." (may have newlines/indentation)
                        ring = coordinateString.trim().split(/\s+/).map(coord => {
                            const parts = coord.split(',');
                            if (parts.length >= 2) {
                                return [parseFloat(parts[0]), parseFloat(parts[1])];
                            }
                            return null;
                        }).filter(point => point !== null);
                    }
                    // GeoJSON requires closed rings (first point == last point)
                    if (ring.length > 0) {
                        const first = ring[0];
                        const last = ring[ring.length - 1];
                        if (first[0] !== last[0] || first[1] !== last[1]) {
                            ring.push([first[0], first[1]]);
                        }
                    }
                    return [ring];
                }

                const geojson = {
                    type: 'FeatureCollection',
                    features: polygons.map(p => {
                        const coordinates = parseCoordinates(p.coordinates);
                        return {
                            type: 'Feature',
                            properties: {
                                fill: '#ff4000',
                                'fill-opacity': 0.3,
                                stroke: '#ff4000',
                                'stroke-width': 2
                            },
                            geometry: {
                                type: 'Polygon',
                                coordinates: coordinates
                            }
                        };
                    }).filter(f => f.geometry.coordinates[0] && f.geometry.coordinates[0].length > 0)
                };

                if (geojson.features.length === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'No valid polygon coordinates found' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Simplify polygon rings if needed to fit Mapbox GET URL limit (~8KB)
                function simplifyRing(ring, maxPoints) {
                    if (ring.length <= maxPoints) return ring;
                    const step = (ring.length - 1) / (maxPoints - 1);
                    const simplified = [];
                    for (let i = 0; i < maxPoints - 1; i++) {
                        simplified.push(ring[Math.round(i * step)]);
                    }
                    // Always keep the closing point
                    simplified.push(ring[ring.length - 1]);
                    return simplified;
                }

                const mapboxToken = env.MAPBOX_SERVER_TOKEN || env.MAPBOX_TOKEN;
                if (!mapboxToken) {
                    return new Response(JSON.stringify({ success: false, error: 'Mapbox token not configured' }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Try with full coordinates, simplify if URL too long
                let geojsonStr = JSON.stringify(geojson);
                if (encodeURIComponent(geojsonStr).length > 6000) {
                    // Simplify each polygon ring to ~80 points max
                    for (const feature of geojson.features) {
                        feature.geometry.coordinates = feature.geometry.coordinates.map(
                            ring => simplifyRing(ring, 80)
                        );
                    }
                    geojsonStr = JSON.stringify(geojson);
                }

                const geojsonEncoded = encodeURIComponent(geojsonStr);
                const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/geojson(${geojsonEncoded})/auto/600x400?padding=20&access_token=${mapboxToken}`;
                const mapResponse = await fetch(mapboxUrl);

                if (!mapResponse.ok) {
                    const errorText = await mapResponse.text();
                    console.error('Mapbox API error:', mapResponse.status, errorText);
                    return new Response(JSON.stringify({ success: false, error: `Mapbox error (${mapResponse.status}): ${errorText.substring(0, 200)}` }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Upload to Supabase Storage
                const imageBuffer = await mapResponse.arrayBuffer();
                const { error: uploadError } = await adminSupabase.storage
                    .from('area-maps')
                    .upload(`${areaId}.png`, imageBuffer, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) {
                    console.error('Storage upload error:', uploadError);
                    return new Response(JSON.stringify({ success: false, error: `Upload error: ${uploadError.message}` }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                const imageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/area-maps/${areaId}.png`;
                return new Response(JSON.stringify({ success: true, data: { image_url: imageUrl } }), {
                    status: 201, headers: { 'Content-Type': 'application/json' }
                });
              } catch (genError) {
                console.error('Generate map error:', genError);
                return new Response(JSON.stringify({ success: false, error: `Generate failed: ${genError.message}` }), {
                    status: 500, headers: { 'Content-Type': 'application/json' }
                });
              }
            }

            // --- Upload custom map image: POST /api/admin/area/:id/upload-map ---
            if (subAction === 'upload-map' && method === 'POST' && id) {
                const areaId = parseInt(id, 10);
                if (isNaN(areaId)) {
                    return new Response(JSON.stringify({ success: false, error: 'Invalid area ID' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                const imageData = await request.arrayBuffer();
                if (!imageData || imageData.byteLength === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'No image data provided' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                const { error: uploadError } = await adminSupabase.storage
                    .from('area-maps')
                    .upload(`${areaId}.png`, imageData, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) {
                    return new Response(JSON.stringify({ success: false, error: uploadError.message }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                const imageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/area-maps/${areaId}.png`;
                return new Response(JSON.stringify({ success: true, data: { image_url: imageUrl } }), {
                    status: 201, headers: { 'Content-Type': 'application/json' }
                });
            }

            // --- Delete map image: DELETE /api/admin/area/:id/map ---
            if (subAction === 'map' && method === 'DELETE' && id) {
                const areaId = parseInt(id, 10);
                if (isNaN(areaId)) {
                    return new Response(JSON.stringify({ success: false, error: 'Invalid area ID' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                const { error: deleteError } = await adminSupabase.storage
                    .from('area-maps')
                    .remove([`${areaId}.png`]);

                if (deleteError) {
                    return new Response(JSON.stringify({ success: false, error: deleteError.message }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({ success: true, message: 'Map image deleted' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // --- Generate sample address from polygon centroid: POST /api/admin/area/:id/generate-address ---
            if (subAction === 'generate-address' && method === 'POST' && id) {
              try {
                const areaId = parseInt(id, 10);
                if (isNaN(areaId)) {
                    return new Response(JSON.stringify({ success: false, error: 'Invalid area ID' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Fetch active polygons for this area
                const { data: polygons, error: polyError } = await adminSupabase
                    .from('area_polygon')
                    .select('coordinates')
                    .eq('area_id', areaId)
                    .eq('active', true);

                if (polyError) {
                    return new Response(JSON.stringify({ success: false, error: `DB error: ${polyError.message}` }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                if (!polygons || polygons.length === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'No active polygons found for this area' }), {
                        status: 404, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Parse all polygon coordinates and collect all points
                const allPoints = [];
                for (const p of polygons) {
                    let ring;
                    try {
                        const jsonPaths = JSON.parse(p.coordinates);
                        ring = jsonPaths.map(coord => ({ lng: coord.lng, lat: coord.lat }));
                    } catch (e) {
                        ring = p.coordinates.trim().split(/\s+/).map(coord => {
                            const parts = coord.split(',');
                            if (parts.length >= 2) {
                                return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
                            }
                            return null;
                        }).filter(pt => pt !== null);
                    }
                    allPoints.push(...ring);
                }

                if (allPoints.length === 0) {
                    return new Response(JSON.stringify({ success: false, error: 'No valid coordinates found' }), {
                        status: 400, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Calculate centroid (average of all points)
                const centroid = {
                    lat: allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length,
                    lng: allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length
                };

                // Reverse geocode via Nominatim
                const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centroid.lat}&lon=${centroid.lng}&addressdetails=1&zoom=18`;
                const geoResponse = await fetch(nominatimUrl, {
                    headers: { 'User-Agent': 'Vergeside Admin (vergeside.com.au)' }
                });

                let address = '';
                if (geoResponse.ok) {
                    const geoData = await geoResponse.json();
                    if (geoData && geoData.address) {
                        const a = geoData.address;
                        const road = a.road;
                        const suburb = a.suburb || a.town || a.city_district;
                        if (road && suburb) {
                            address = `${road}, ${suburb}`;
                        } else if (road) {
                            address = road;
                        }
                    }
                }

                if (!address) {
                    return new Response(JSON.stringify({ success: false, error: 'Could not resolve address from centroid' }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Update area's sample_address
                const { error: updateError } = await adminSupabase
                    .from('area')
                    .update({ sample_address: address })
                    .eq('id', areaId);

                if (updateError) {
                    return new Response(JSON.stringify({ success: false, error: `Update error: ${updateError.message}` }), {
                        status: 500, headers: { 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({
                    success: true,
                    data: {
                        address,
                        centroid,
                        point_count: allPoints.length
                    }
                }), { headers: { 'Content-Type': 'application/json' } });
              } catch (genError) {
                console.error('Generate address error:', genError);
                return new Response(JSON.stringify({ success: false, error: `Generate failed: ${genError.message}` }), {
                    status: 500, headers: { 'Content-Type': 'application/json' }
                });
              }
            }

            // --- Standard area CRUD (existing handlers below) ---
             if (method === 'GET') {
                let query = adminSupabase.from('area').select('*, council:council_id (id, name, bulk_waste_url)');

                // Filter by council if requested (for list view)
                const councilId = url.searchParams.get('council_id');
                const searchTerm = url.searchParams.get('search');
                
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
                     
                     // Add search functionality
                     if (searchTerm) {
                         query = query.ilike('name', `%${searchTerm}%`);
                     }
                 }

                const { data, error } = await query;
                if (error) throw error;
                // Handle case where single record is requested but not found
                if (id && !data) {
                     return new Response(JSON.stringify({ success: false, error: 'Area not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }
                return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
            }
            else if (method === 'POST') {
                const body = await request.json();
                const { name, council_id, sample_address } = body;
                
                // Validate required fields
                if (!name) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: name' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                if (!council_id) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: council_id' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                // Parse council_id as integer
                const councilIdInt = parseInt(council_id, 10);
                if (isNaN(councilIdInt)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid council_id: must be a number' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                // Prepare the insert data
                const insertData = {
                    name,
                    council_id: councilIdInt,
                    sample_address: sample_address || null
                };
                
                const { data, error } = await adminSupabase
                    .from('area')
                    .insert(insertData)
                    .select();
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                if (!data || data.length === 0) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'No data returned after insert' 
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
                
                return new Response(JSON.stringify({ success: true, data: data[0] }), { 
                    status: 201, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'PUT' && id) {
                const areaId = parseInt(id, 10);
                if (isNaN(areaId)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid area ID' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const body = await request.json();
                const { name, council_id, sample_address } = body;
                
                // Validate required fields
                if (!name) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: name' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                if (!council_id) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required field: council_id' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                // Parse council_id as integer
                const councilIdInt = parseInt(council_id, 10);
                if (isNaN(councilIdInt)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid council_id: must be a number' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                // Prepare the update data
                const updateData = {
                    name,
                    council_id: councilIdInt,
                    sample_address: sample_address || null
                };
                
                const { data, error } = await adminSupabase
                    .from('area')
                    .update(updateData)
                    .eq('id', areaId)
                    .select();
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                if (!data || data.length === 0) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Area not found or no changes applied' 
                    }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }
                
                return new Response(JSON.stringify({ success: true, data: data[0] }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'DELETE' && id) {
                const areaId = parseInt(id, 10);
                if (isNaN(areaId)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid area ID' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const { error } = await adminSupabase
                    .from('area')
                    .delete()
                    .eq('id', areaId);
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ success: true, message: 'Area deleted successfully' }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
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
        else if (resource === 'email_subscribers') {
            // Email subscribers management
            if (method === 'GET') {
                // Handle stats endpoint
                if (pathSegments[1] === 'stats') {
                    // Get subscriber statistics
                    const { count: totalCount, error: totalError } = await adminSupabase
                        .from('email_subscribers')
                        .select('*', { count: 'exact', head: true });

                    if (totalError) {
                        return new Response(JSON.stringify({ success: false, error: totalError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    const { count: activeCount, error: activeError } = await adminSupabase
                        .from('email_subscribers')
                        .select('*', { count: 'exact', head: true })
                        .eq('is_active', true);

                    if (activeError) {
                        return new Response(JSON.stringify({ success: false, error: activeError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    const { count: recentCount, error: recentError } = await adminSupabase
                        .from('email_subscribers')
                        .select('*', { count: 'exact', head: true })
                        .gte('created_at', weekAgo.toISOString());

                    if (recentError) {
                        return new Response(JSON.stringify({ success: false, error: recentError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        data: {
                            total: totalCount || 0,
                            active: activeCount || 0,
                            inactive: (totalCount || 0) - (activeCount || 0),
                            recent: recentCount || 0
                        }
                    }), { headers: { 'Content-Type': 'application/json' } });
                }
                // Handle single subscriber by ID
                else if (id) {
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRegex.test(id)) {
                        return new Response(JSON.stringify({ 
                            success: false, 
                            error: 'Invalid subscriber ID format' 
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                    }
                    
                    const { data, error } = await adminSupabase
                        .from('email_subscribers')
                        .select('*')
                        .eq('id', id)
                        .single();
                        
                    if (error) {
                        if (error.code === 'PGRST116') {
                            return new Response(JSON.stringify({ success: false, error: 'Subscriber not found' }), { 
                                status: 404, headers: { 'Content-Type': 'application/json' } 
                            });
                        }
                        return new Response(JSON.stringify({ success: false, error: error.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    return new Response(JSON.stringify({ success: true, data }), { 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                // Handle list with filtering and pagination
                else {
                    const search = url.searchParams.get('search');
                    const status = url.searchParams.get('status');
                    const page = parseInt(url.searchParams.get('page') || '1', 10);
                    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
                    const sort = url.searchParams.get('sort') || 'created_at';
                    const order = url.searchParams.get('order') || 'desc';

                    let query = adminSupabase
                        .from('email_subscribers')
                        .select('*', { count: 'exact' });

                    if (search) {
                        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
                    }

                    if (status !== null && status !== '') {
                        query = query.eq('is_active', status === 'true');
                    }

                    const validSortFields = ['name', 'email', 'created_at', 'updated_at', 'is_active'];
                    const validOrders = ['asc', 'desc'];
                    
                    if (validSortFields.includes(sort) && validOrders.includes(order)) {
                        query = query.order(sort, { ascending: order === 'asc' });
                    } else {
                        query = query.order('created_at', { ascending: false });
                    }

                    if (page > 0 && limit > 0) {
                        const from = (page - 1) * limit;
                        const to = from + limit - 1;
                        query = query.range(from, to);
                    }

                    const { data, error, count } = await query;
                        
                    if (error) {
                        return new Response(JSON.stringify({ success: false, error: error.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    return new Response(JSON.stringify({ 
                        success: true, 
                        data,
                        pagination: {
                            page: page || 1,
                            limit: limit || 50,
                            total: count,
                            pages: Math.ceil((count || 0) / (limit || 50))
                        }
                    }), { headers: { 'Content-Type': 'application/json' } });
                }
            }
            else if (method === 'POST') {
                const body = await request.json();
                const { name, email, is_active = true } = body;
                
                if (!name || !email) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required fields: name and email' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Invalid email format'
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const insertData = {
                    name: name.trim(),
                    email: email.toLowerCase().trim(),
                    is_active: Boolean(is_active)
                };
                
                const { data, error } = await adminSupabase
                    .from('email_subscribers')
                    .insert(insertData)
                    .select()
                    .single();
                    
                if (error) {
                    if (error.code === '23505') {
                        return new Response(JSON.stringify({ 
                            success: false, 
                            error: 'Email address already exists' 
                        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
                    }
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ success: true, data }), { 
                    status: 201, headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'PUT' && id) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid subscriber ID format' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const body = await request.json();
                const { name, email, is_active } = body;
                
                if (!name || !email) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required fields: name and email' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Invalid email format'
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const updateData = {
                    name: name.trim(),
                    email: email.toLowerCase().trim(),
                    is_active: Boolean(is_active),
                    updated_at: new Date().toISOString()
                };
                
                const { data, error } = await adminSupabase
                    .from('email_subscribers')
                    .update(updateData)
                    .eq('id', id)
                    .select()
                    .single();
                    
                if (error) {
                    if (error.code === 'PGRST116') {
                        return new Response(JSON.stringify({ success: false, error: 'Subscriber not found' }), { 
                            status: 404, headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    if (error.code === '23505') {
                        return new Response(JSON.stringify({ 
                            success: false, 
                            error: 'Email address already exists' 
                        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
                    }
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ success: true, data }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'DELETE' && id) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid subscriber ID format' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const { error } = await adminSupabase
                    .from('email_subscribers')
                    .delete()
                    .eq('id', id);
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ success: true, message: 'Subscriber deleted successfully' }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            else if (method === 'PATCH' && pathSegments[1] === 'bulk') {
                // Bulk update subscribers
                const body = await request.json();
                const { ids, is_active } = body;
                
                if (!Array.isArray(ids) || ids.length === 0) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing or invalid ids array' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                if (typeof is_active !== 'boolean') {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'is_active must be a boolean' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                for (const id of ids) {
                    if (!uuidRegex.test(id)) {
                        return new Response(JSON.stringify({ 
                            success: false, 
                            error: `Invalid subscriber ID format: ${id}` 
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                    }
                }
                
                const { data, error } = await adminSupabase
                    .from('email_subscribers')
                    .update({ 
                        is_active, 
                        updated_at: new Date().toISOString() 
                    })
                    .in('id', ids)
                    .select();
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: `${data.length} subscribers updated successfully`,
                    data
                }), { headers: { 'Content-Type': 'application/json' } });
            }
            else if (method === 'DELETE' && pathSegments[1] === 'bulk') {
                // Bulk delete subscribers
                const body = await request.json();
                const { ids } = body;
                
                if (!Array.isArray(ids) || ids.length === 0) {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: 'Missing or invalid ids array' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                for (const id of ids) {
                    if (!uuidRegex.test(id)) {
                        return new Response(JSON.stringify({ 
                            success: false, 
                            error: `Invalid subscriber ID format: ${id}` 
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                    }
                }
                
                const { error } = await adminSupabase
                    .from('email_subscribers')
                    .delete()
                    .in('id', ids);
                    
                if (error) {
                    return new Response(JSON.stringify({ success: false, error: error.message }), { 
                        status: 400, headers: { 'Content-Type': 'application/json' } 
                    });
                }
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'Subscribers deleted successfully'
                }), { headers: { 'Content-Type': 'application/json' } });
            }
        }
        else if (resource === 'email_send_log') {
            // Email send log management
            if (method === 'GET') {
                // Handle stats endpoint
                if (pathSegments[1] === 'stats') {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    
                    const { count: totalSent, error: totalError } = await adminSupabase
                        .from('email_send_log')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', 'sent')
                        .gte('sent_at', thirtyDaysAgo.toISOString());

                    if (totalError) {
                        return new Response(JSON.stringify({ success: false, error: totalError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    const { count: totalFailed, error: failedError } = await adminSupabase
                        .from('email_send_log')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', 'failed')
                        .gte('sent_at', thirtyDaysAgo.toISOString());

                    if (failedError) {
                        return new Response(JSON.stringify({ success: false, error: failedError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    const { data: lastSuccess, error: lastSuccessError } = await adminSupabase
                        .from('email_send_log')
                        .select('sent_at, recipient_count')
                        .eq('status', 'sent')
                        .eq('email_type', 'weekly')
                        .order('sent_at', { ascending: false })
                        .limit(1);

                    if (lastSuccessError) {
                        return new Response(JSON.stringify({ success: false, error: lastSuccessError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    const { count: recentActivity, error: recentError } = await adminSupabase
                        .from('email_send_log')
                        .select('*', { count: 'exact', head: true })
                        .gte('sent_at', sevenDaysAgo.toISOString());

                    if (recentError) {
                        return new Response(JSON.stringify({ success: false, error: recentError.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        data: {
                            total_sent_30d: totalSent || 0,
                            total_failed_30d: totalFailed || 0,
                            last_successful_send: lastSuccess && lastSuccess.length > 0 ? {
                                sent_at: lastSuccess[0].sent_at,
                                recipient_count: lastSuccess[0].recipient_count
                            } : null,
                            recent_activity_7d: recentActivity || 0
                        }
                    }), { headers: { 'Content-Type': 'application/json' } });
                }
                // Handle single log entry by ID
                else if (id) {
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRegex.test(id)) {
                        return new Response(JSON.stringify({ 
                            success: false, 
                            error: 'Invalid email log ID format' 
                        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                    }
                    
                    const { data, error } = await adminSupabase
                        .from('email_send_log')
                        .select('*')
                        .eq('id', id)
                        .single();
                        
                    if (error) {
                        if (error.code === 'PGRST116') {
                            return new Response(JSON.stringify({ success: false, error: 'Email log entry not found' }), { 
                                status: 404, headers: { 'Content-Type': 'application/json' } 
                            });
                        }
                        return new Response(JSON.stringify({ success: false, error: error.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    return new Response(JSON.stringify({ success: true, data }), { 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                // Handle list with filtering and pagination
                else {
                    const status = url.searchParams.get('status');
                    const email_type = url.searchParams.get('email_type') || 'weekly';
                    const page = parseInt(url.searchParams.get('page') || '1', 10);
                    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
                    const order = url.searchParams.get('order') || 'sent_at.desc';

                    let query = adminSupabase
                        .from('email_send_log')
                        .select('*', { count: 'exact' });

                    if (status && ['sent', 'failed', 'pending'].includes(status)) {
                        query = query.eq('status', status);
                    }

                    if (email_type) {
                        query = query.eq('email_type', email_type);
                    }

                    const validOrders = [
                        'sent_at.desc', 'sent_at.asc',
                        'status.desc', 'status.asc',
                        'email_type.desc', 'email_type.asc'
                    ];
                    
                    if (validOrders.includes(order)) {
                        const [field, direction] = order.split('.');
                        query = query.order(field, { ascending: direction === 'asc' });
                    } else {
                        query = query.order('sent_at', { ascending: false });
                    }

                    if (page > 0 && limit > 0) {
                        const from = (page - 1) * limit;
                        const to = from + limit - 1;
                        query = query.range(from, to);
                    }

                    const { data, error, count } = await query;
                        
                    if (error) {
                        return new Response(JSON.stringify({ success: false, error: error.message }), { 
                            status: 400, headers: { 'Content-Type': 'application/json' } 
                        });
                    }
                    
                    return new Response(JSON.stringify({ 
                        success: true, 
                        data,
                        pagination: {
                            page: page || 1,
                            limit: limit || 20,
                            total: count,
                            pages: Math.ceil((count || 0) / (limit || 20))
                        }
                    }), { headers: { 'Content-Type': 'application/json' } });
                }
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
