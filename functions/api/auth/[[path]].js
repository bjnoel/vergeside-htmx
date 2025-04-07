import { createClient } from '@supabase/supabase-js';

// --- Reusable Supabase Admin Client ---
// Duplicated from admin function - consider moving to a shared lib later
function getAdminSupabaseClient(env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase environment variables");
        throw new Error("Server configuration error: Supabase credentials missing.");
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- Main Request Handler ---
export async function onRequest(context) {
    const { request, env, params } = context;
    console.log('Function Env:', env); // Added for debugging
    const url = new URL(request.url);
    const pathSegments = params.path || [];
    const action = pathSegments[0]; // 'login', 'callback', 'logout'

    // --- Auth0 Config ---
    // Ensure these are set in Cloudflare Pages environment variables
    const auth0Config = {
        domain: env.AUTH0_DOMAIN,
        clientId: env.AUTH0_CLIENT_ID,
        clientSecret: env.AUTH0_SECRET_KEY, // Use the new variable name
        // Determine callback URL based on environment (dev vs prod)
        callbackUrl: url.origin + '/api/auth/callback' // Assumes wrangler runs on root
    };

    // Log the value right before the check, without logging the secret itself
    console.log('Value of env.AUTH0_SECRET_KEY before check:', typeof env.AUTH0_SECRET_KEY, env.AUTH0_SECRET_KEY ? 'Exists and is truthy' : 'Does NOT exist or is falsy'); // Use new name

    // More specific check for missing variables
    const missingVars = [];
    if (!auth0Config.domain) missingVars.push('AUTH0_DOMAIN');
    if (!auth0Config.clientId) missingVars.push('AUTH0_CLIENT_ID');
    if (!auth0Config.clientSecret) missingVars.push('AUTH0_SECRET_KEY'); // Check the new secret name

    if (missingVars.length > 0) {
        const errorMsg = `Missing Auth0 environment variable(s): ${missingVars.join(', ')}`;
        console.error(errorMsg);
        // Also log the env object keys to see what *is* available in production
        console.error("Available env keys in production:", Object.keys(env).join(', '));
        return new Response(JSON.stringify({ success: false, error: "Auth0 server configuration error." }), { status: 500 });
    }

    // --- Routing ---
    try {
        if (action === 'login') {
            console.log('Auth0 login function accessed');
            const redirectUrl = `https://${auth0Config.domain}/authorize?` +
                `response_type=code&` +
                `client_id=${auth0Config.clientId}&` +
                `audience=${env.AUTH0_AUDIENCE}&` + // Add audience parameter
                `redirect_uri=${auth0Config.callbackUrl}&` +
                `scope=openid profile email`; // Add any necessary API scopes here later if needed

            console.log(`Redirecting to Auth0: ${redirectUrl}`);
            return Response.redirect(redirectUrl, 302);

        } else if (action === 'callback') {
            console.log('--- Auth0 Callback Function START ---'); // Add this log
            console.log('Auth0 callback function accessed');
            const code = url.searchParams.get('code');

            if (!code) {
                console.log('No code provided in callback');
                return Response.redirect('/admin/index.html?error=missing_code', 302);
            }

            // Exchange code for tokens
            console.log('Exchanging code for tokens...');
            const tokenResponse = await fetch(`https://${auth0Config.domain}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    client_id: auth0Config.clientId,
                    client_secret: auth0Config.clientSecret,
                    code,
                    redirect_uri: auth0Config.callbackUrl
                })
            });

            const tokens = await tokenResponse.json();

            if (!tokenResponse.ok || tokens.error) {
                console.error('Token exchange error:', tokens.error || tokenResponse.statusText);
                return Response.redirect(`/admin/index.html?error=${tokens.error || 'token_exchange_failed'}`, 302);
            }

            // Get user info
            console.log('Getting user info...');
            const userInfoResponse = await fetch(`https://${auth0Config.domain}/userinfo`, {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });

            if (!userInfoResponse.ok) {
                 console.error('Failed to fetch user info:', userInfoResponse.statusText);
                 return Response.redirect(`/admin/index.html?error=userinfo_failed`, 302);
            }

            const userInfo = await userInfoResponse.json();
            const userEmail = userInfo.email;

            if (!userEmail) {
                 console.error('User info does not contain email');
                 return Response.redirect(`/admin/index.html?error=email_missing`, 302);
            }
            console.log('User info retrieved:', userInfo);

            // Check if user is an admin using adminSupabase
            console.log('Checking admin whitelist for:', userEmail);
            let adminSupabase;
            try {
                adminSupabase = getAdminSupabaseClient(env);
                const { data: adminUser, error: adminCheckError } = await adminSupabase
                    .from('admin_users')
                    .select('email') // Only select necessary field
                    .ilike('email', userEmail)
                    .maybeSingle();

                if (adminCheckError) {
                    console.error('Error checking admin status:', adminCheckError);
                    throw new Error(`Admin check failed: ${adminCheckError.message}`);
                }

                if (!adminUser) {
                    console.error('Admin check failed: User not in admin_users table:', userEmail);
                    return Response.redirect('/admin/index.html?error=not_authorized&message=' +
                        encodeURIComponent('You are not authorized to access this area.'), 302);
                }

                console.log('Admin user verified:', adminUser.email);

            } catch (error) {
                console.error('Error during admin verification:', error);
                return Response.redirect('/admin/index.html?error=admin_check_error&message=' +
                    encodeURIComponent('Error verifying admin status. Please contact support.'), 302);
            }

            // Set cookies
            const cookieOptions = {
                path: '/',
                secure: url.protocol === 'https:', // Use secure cookies in production
                maxAge: 24 * 60 * 60, // 24 hours in seconds
                sameSite: 'Lax'
            };

            const headers = new Headers();
            // Log the received tokens for debugging
            console.log("Tokens received from Auth0:", tokens);

            headers.append('Set-Cookie', `admin_email=${userEmail}; ${cookieOptions.httpOnly ? 'HttpOnly; ' : ''}Max-Age=${cookieOptions.maxAge}; Path=${cookieOptions.path}; ${cookieOptions.secure ? 'Secure; ' : ''}SameSite=${cookieOptions.sameSite}`);
            headers.append('Set-Cookie', `admin_auth=${encodeURIComponent(JSON.stringify({
                email: userEmail,
                name: userInfo.name || '',
                picture: userInfo.picture || '',
                access_token: tokens.access_token, // Explicitly use access_token here
                // id_token: tokens.id_token, // We could store id_token too if needed, but access_token is for APIs
                authenticated: true,
                timestamp: new Date().toISOString()
            }))}; Max-Age=${cookieOptions.maxAge}; Path=${cookieOptions.path}; ${cookieOptions.secure ? 'Secure; ' : ''}SameSite=${cookieOptions.sameSite}`); // Note: HttpOnly removed for client access

            // Redirect to admin dashboard
            console.log('Authentication successful, redirecting to admin dashboard');
            headers.append('Location', '/admin/index.html?login=success');
            return new Response(null, { status: 302, headers });


        } else if (action === 'logout') {
            console.log('Logout function accessed');

            // Clear cookies by setting expiry in the past
            const pastDate = new Date(0).toUTCString();
            const headers = new Headers();
            headers.append('Set-Cookie', `admin_email=; Path=/; Expires=${pastDate}; HttpOnly; SameSite=Lax`);
            headers.append('Set-Cookie', `admin_auth=; Path=/; Expires=${pastDate}; SameSite=Lax`);

            // Redirect to Auth0 logout
            const logoutUrl = `https://${auth0Config.domain}/v2/logout?` +
                `client_id=${auth0Config.clientId}&` +
                `returnTo=${encodeURIComponent(url.origin)}`; // Redirect back to the site origin

             headers.append('Location', logoutUrl);
             return new Response(null, { status: 302, headers });

        } else {
            return new Response(JSON.stringify({ success: false, error: 'Auth route not found' }), { status: 404 });
        }

    } catch (error) {
        console.error(`Auth Function Error (${action}):`, error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Internal Server Error' }), { status: 500 });
    }
}
