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
            // Check if we have a session
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                this.user = session.user;
                // Verify admin access
                await this.checkAdminAccess();
            } else {
                this.isAuthenticated = false;
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Authentication initialization error:', error);
            this.isAuthenticated = false;
        } finally {
            this.initialized = true;
            // Dispatch event once auth is initialized
            window.dispatchEvent(new CustomEvent('admin-auth-initialized'));
        }
    }

    async checkAdminAccess() {
        if (!this.user) {
            this.isAuthenticated = false;
            return false;
        }

        try {
            // Query the admin_users table to check if this user's email is whitelisted
            const { data, error } = await this.supabase
                .from('admin_users')
                .select('*')
                .eq('email', this.user.email)
                .single();
            
            if (error || !data) {
                console.error('Admin access check failed:', error);
                this.isAuthenticated = false;
                await this.signOut();
                return false;
            }

            // Update last sign-in timestamp
            await this.supabase
                .from('admin_users')
                .update({ last_sign_in: new Date().toISOString() })
                .eq('email', this.user.email);
            
            this.isAuthenticated = true;
            return true;
        } catch (error) {
            console.error('Error checking admin access:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    async signOut() {
        try {
            await this.supabase.auth.signOut();
            this.isAuthenticated = false;
            this.user = null;
            this.redirectToLogin();
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
