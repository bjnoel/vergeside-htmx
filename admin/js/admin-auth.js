/**
 * Admin Authentication Module - Using Auth0 with Supabase
 */

class AdminAuth {
    constructor() {
        this.supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        this.isAuthenticated = false;
        this.user = null;
        this.initialized = false;
        
        // Initialize authentication state
        this.init();
    }

    async init() {
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
                    
                    if (userData && userData.email && userData.authenticated) {
                        // Set user information from cookie
                        this.user = {
                            email: userData.email,
                            name: userData.name || '',
                            picture: userData.picture || ''
                        };
                        this.isAuthenticated = true;
                        console.log('Authenticated from cookie for user:', this.user.email);
                    } else {
                        this.isAuthenticated = false;
                        console.log('Invalid cookie data');
                        this.redirectToLogin();
                    }
                } catch (e) {
                    console.error('Error parsing admin_auth cookie:', e);
                    this.isAuthenticated = false;
                    this.redirectToLogin();
                }
            } else {
                // No authentication cookie found
                console.log('No admin_auth cookie found');
                this.isAuthenticated = false;
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Authentication initialization error:', error);
            this.isAuthenticated = false;
            this.redirectToLogin();
        } finally {
            this.initialized = true;
            // Dispatch event once auth is initialized
            window.dispatchEvent(new CustomEvent('admin-auth-initialized'));
        }
    }

    async checkAdminAccess() {
        if (!this.user || !this.user.email) {
            this.isAuthenticated = false;
            return false;
        }

        try {
            // Check with the server if this user is authenticated
            const response = await fetch('/api/auth/check');
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

    // Check if the user is authenticated and an admin
    isAdmin() {
        return this.isAuthenticated;
    }

    // Wait for authentication to be initialized
    async waitForInitialization() {
        if (this.initialized) return;
        
        return new Promise(resolve => {
            window.addEventListener('admin-auth-initialized', () => {
                resolve();
            });
        });
    }
}

// Create a singleton instance
const adminAuth = new AdminAuth();
