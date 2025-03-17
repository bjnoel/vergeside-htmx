// Configuration settings for the application

const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://wihegqwakwwvckxrivem.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGVncXdha3d3dmNreHJpdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2Mzg1NDksImV4cCI6MjA1NjIxNDU0OX0.aP2ThYybxtUE6JaVHs1sowZaDfAbxxPC_yBotY5qApM',
    
    // Google Maps API Configuration
    MAPS_API_KEY: 'AIzaSyCzF7ukLxzRdcoEpBpr-YFV_4hroVUYXqE',
    
    // Date Format Configuration
    DEFAULT_DATE_FORMAT: 'YYYY-MM-DD',
    
    // Map Configuration
    MAP_DEFAULT_CENTER: { lat: -31.9505, lng: 115.8605 }, // Perth, WA as default
    MAP_DEFAULT_ZOOM: 10,
    
    // Color Coding for Map Areas
    COLORS: {
        TODAY: '#FF0000', // Red
        THIS_WEEK: '#FFA500', // Orange
        NEXT_WEEK: '#FFFF00', // Yellow
        TWO_WEEKS: '#008000', // Green
        THREE_WEEKS: '#0000FF', // Blue
        FOUR_PLUS_WEEKS: '#800080', // Purple
        DEFAULT: '#808080' // Gray
    },
    
    // Initial Date Range (4 weeks by default)
    DEFAULT_DATE_RANGE: {
        START_OFFSET: 0, // Days from today
        END_OFFSET: 28 // Days from today
    }
};