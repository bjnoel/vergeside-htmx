/**
 * Admin Authentication Module - Using Auth0 with server-side authentication
 * No direct Supabase calls for admin operations to avoid Row-Level Security (RLS) issues
 */

class AdminAuth {
    constructor() {
        // No direct Supabase client for admin operations - we'll use server API endpoints
        this.isAuthenticated = false;
        this.user = null;
        this.initialized = false;

        // Initialize authentication state synchronously
        this.init();
    }

    // Make init synchronous for cookie reading and state setting
    init() {
        let authenticated = false;
        let userFromCookie = null;
        let initError = null;

        try {
            // Check if we have a cookie-based authentication
            const adminAuthCookie = document.cookie
                .split('; ')
                .find(row => row.startsWith('admin_auth='));

            if (adminAuthCookie) {
                try {
                    // Parse the cookie value
                    const userData = JSON.parse(decodeURIComponent(adminAuthCookie.split('=')[1]));
                    console.log('User data from cookie:', userData);
                    if (userData && userData.email && userData.authenticated && userData.access_token) {
                        userFromCookie = {
                            email: userData.email,
                            name: userData.name || '',
                            picture: userData.picture || '',
                            access_token: userData.access_token
                        };
                        authenticated = true;
                        console.log('Auth check: Valid cookie found for', userFromCookie.email);
                    } else {
                        console.log('Auth check: Invalid cookie data');
                        // Clear potentially bad cookie? Consider adding later if needed.
                    }
                } catch (e) {
                    console.error('Auth check: Error parsing cookie', e);
                    initError = e;
                    // Clear potentially bad cookie? Consider adding later if needed.
                }
            } else {
                console.log('Auth check: No cookie found');
            }
        } catch (error) {
            // Catch potential errors in finding the cookie itself (less likely)
            console.error('Auth check: Error reading cookies', error);
            initError = error;
        }

        // Set final state
        this.isAuthenticated = authenticated;
        this.user = userFromCookie;

        // --- Redirection Logic ---
        const isOnLoginPage = window.location.pathname === '/admin/index.html' || window.location.pathname === '/admin/' || window.location.pathname === '/admin';
        const urlParams = new URLSearchParams(window.location.search);
        const justLoggedIn = urlParams.get('login') === 'success';

        // Redirect only if necessary
        let shouldRedirect = false;
        let redirectUrl = '';

        if (this.isAuthenticated) {
            // Only redirect from login page IF justLoggedIn is true
            if (isOnLoginPage && justLoggedIn) {
                console.log('Redirecting successful login from login page to /admin/index.html'); // Corrected redirect target
                redirectUrl = '/admin/index.html'; // Redirect to the dashboard/index page
                shouldRedirect = true;
                // Clean URL after deciding to redirect
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            // If authenticated and NOT on login page, or on login page without ?login=success, no redirect needed.
        } else { // Not authenticated
            if (!isOnLoginPage) {
                console.log('Redirecting unauthenticated user to login page');
                redirectUrl = '/admin/index.html'; // Use the specific login page URL
                shouldRedirect = true;
            }
            // If not authenticated and already on login page, no redirect needed.
        }


        // Perform redirect if decided
        if (shouldRedirect) {
            window.location.href = redirectUrl;
            // If we redirect, don't dispatch the initialized event yet,
            // let the next page load handle its own initialization.
            return; // Exit if redirecting
        }

        // If no redirect happened, mark as initialized
        this.initialized = true;
        console.log('AdminAuth initialized synchronously. Authenticated:', this.isAuthenticated);
    }

    // checkAdminAccess remains async as it uses fetch
    async checkAdminAccess() {
        // This function seems unused now, consider removing later
        if (!this.user || !this.user.email) {
            this.isAuthenticated = false;
            return false;
        }

        try {
            // Check with the server if this user is authenticated
            const response = await fetch('/api/auth/check'); // This endpoint might not exist/be needed anymore
            const data = await response.json();

            if (data.authenticated && data.email) {
                this.isAuthenticated = true;
                return true;
            }

            this.isAuthenticated = false;
            return false;
        } catch (error) {
            console.error('Error checking admin access:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    async signOut() {
        try {
            // Redirect to the server logout endpoint
            window.location.href = '/api/auth/logout';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }

    redirectToLogin() {
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/admin/index.html' &&
            window.location.pathname !== '/admin/' &&
            window.location.pathname !== '/admin') {
            window.location.href = '/admin/index.html';
        }
    }

    // Get the current authenticated user
    getUser() {
        return this.user;
    }

    // Get the access token
    getAccessToken() {
        const token = this.user ? this.user.access_token : null;
        console.log('getAccessToken called, returning:', token ? 'token found' : 'null'); // Debug log
        return token;
    }

    // Check if the user is authenticated and an admin
    isAdmin() {
        return this.isAuthenticated;
    }

    // Removed waitForInitialization as init is now synchronous
}

// Create a singleton instance
const adminAuth = new AdminAuth();
