// Request Cache Helper
// Helps prevent duplicate requests to the same endpoint

class RequestCache {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.maxCacheSize = 100; // Maximum number of entries to keep in cache
        this.cacheExpiry = 1000 * 60 * 5; // Cache expiry in ms (5 minutes)
        this.debugMode = false;
    }

    // Debug log
    debug(message, data = null) {
        if (this.debugMode) {
            if (data) {
                console.log(`[RequestCache] ${message}`, data);
            } else {
                console.log(`[RequestCache] ${message}`);
            }
        }
    }

    // Generate a cache key from the request
    generateKey(url, params = null) {
        let key = url;
        if (params) {
            try {
                // Sort params to ensure consistent keys regardless of order
                const sortedParams = typeof params === 'string' 
                    ? params 
                    : JSON.stringify(params, Object.keys(params).sort());
                key += `:${sortedParams}`;
            } catch (e) {
                this.debug('Error generating cache key:', e);
                key += `:${JSON.stringify(params)}`;
            }
        }
        return key;
    }

    // Check if a request is already in the cache
    has(key) {
        if (!this.cache.has(key)) {
            return false;
        }
        
        const entry = this.cache.get(key);
        const now = Date.now();
        
        // Check if the entry has expired
        if (now - entry.timestamp > this.cacheExpiry) {
            this.debug(`Cache entry expired for key: ${key}`);
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    // Get a cached response
    get(key) {
        if (this.has(key)) {
            const entry = this.cache.get(key);
            this.debug(`Cache hit for key: ${key}`);
            return entry.data;
        }
        
        this.debug(`Cache miss for key: ${key}`);
        return null;
    }

    // Store a response in the cache
    set(key, data) {
        this.debug(`Caching response for key: ${key}`);
        
        // Create a new cache entry
        const entry = {
            data,
            timestamp: Date.now()
        };
        
        // Check cache size and remove oldest entries if needed
        if (this.cache.size >= this.maxCacheSize) {
            this.debug('Cache full, removing oldest entries');
            const entries = Array.from(this.cache.entries());
            
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            // Remove the oldest entry
            const oldestKey = entries[0][0];
            this.cache.delete(oldestKey);
            this.debug(`Removed oldest entry with key: ${oldestKey}`);
        }
        
        // Store the new entry
        this.cache.set(key, entry);
        return data;
    }

    // Clear the entire cache
    clear() {
        this.debug('Clearing entire cache');
        this.cache.clear();
        this.pendingRequests.clear();
    }

    // Remove a specific key from the cache
    delete(key) {
        this.debug(`Removing cache entry for key: ${key}`);
        this.cache.delete(key);
        this.pendingRequests.delete(key);
    }

    // Execute an async function with caching
    // Returns cached value if available, otherwise executes the function and caches the result
    async execute(cacheKey, asyncFunction) {
        // Check if the result is already in the cache
        if (this.has(cacheKey)) {
            this.debug(`Returning cached result for: ${cacheKey}`);
            return this.get(cacheKey);
        }
        
        // Check if this request is already in progress
        if (this.pendingRequests.has(cacheKey)) {
            this.debug(`Request already in progress for: ${cacheKey}, waiting...`);
            return this.pendingRequests.get(cacheKey);
        }
        
        // Create a new promise and store it in pending requests
        const promise = (async () => {
            try {
                this.debug(`Executing function for key: ${cacheKey}`);
                const result = await asyncFunction();
                
                // Cache the result
                this.set(cacheKey, result);
                
                // Remove from pending requests
                this.pendingRequests.delete(cacheKey);
                
                return result;
            } catch (error) {
                // Remove from pending requests on error
                this.pendingRequests.delete(cacheKey);
                throw error;
            }
        })();
        
        // Store the promise in pending requests
        this.pendingRequests.set(cacheKey, promise);
        
        return promise;
    }
}

// Create a global singleton instance
const requestCache = new RequestCache();

// Optional: Enable debug mode in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    requestCache.debugMode = true;
    console.log('Request cache initialized in debug mode');
}

// Export the singleton instance
window.requestCache = requestCache;
