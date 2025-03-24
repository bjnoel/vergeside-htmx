// Configuration settings for the application

const CONFIG = {
    // Timezone Configuration
    TIMEZONE: '+08:00', // Perth timezone (GMT+8)
    // Supabase Configuration
    SUPABASE_URL: 'https://wihegqwakwwvckxrivem.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGVncXdha3d3dmNreHJpdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2Mzg1NDksImV4cCI6MjA1NjIxNDU0OX0.aP2ThYybxtUE6JaVHs1sowZaDfAbxxPC_yBotY5qApM',
    
    // Google Maps API Configuration - Read from environment variable if available
    MAPS_API_KEY: (typeof MAPS_API_KEY !== 'undefined') ? MAPS_API_KEY : 'AIzaSyCzF7ukLxzRdcoEpBpr-YFV_4hroVUYXqE', // Fallback to hardcoded value in development
    
    // Date Format Configuration
    DEFAULT_DATE_FORMAT: 'YYYY-MM-DD',
    
    // Map Configuration
    MAP_DEFAULT_CENTER: { lat: -31.9505, lng: 115.8605 }, // Perth, WA as default
    MAP_DEFAULT_ZOOM: 10,
    
    // Color Coding for Map Areas (Red to Blue spectrum)
    COLORS: {
        // Colors representing 0-7 days, 8-14 days, etc.
        WEEK_0: '#ff4000', // Red
        WEEK_1: '#ffbf00', // Orange
        WEEK_2: '#ffff00', // Yellow
        WEEK_3: '#bfff00', // Yellow-Green
        WEEK_4: '#80ff00', // Light Green
        WEEK_5: '#40ff00', // Green
        WEEK_6: '#00ff00', // Green
        WEEK_7: '#00ff40', // Green-Cyan
        WEEK_8: '#00ff80', // Light Cyan
        WEEK_9: '#00ffbf', // Cyan
        WEEK_10: '#00ffff', // Cyan
        WEEK_11: '#00bfff', // Light Blue
        WEEK_12: '#0080ff', // Light Blue
        WEEK_13: '#0040ff', // Blue
        WEEK_14: '#0000ff', // Blue
        DEFAULT: '#808080' // Gray for unknown or past dates
    },
    
    // Initial Date Range (4 weeks by default)
    DEFAULT_DATE_RANGE: {
        START_OFFSET: 0, // Days from today
        END_OFFSET: 28 // Days from today
    }
};