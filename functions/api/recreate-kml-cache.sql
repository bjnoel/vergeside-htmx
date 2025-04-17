-- Recreate KML cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.kml_cache (
    id SERIAL PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    kml_content TEXT NOT NULL,
    parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp
);

-- Add index on cache_key for faster lookups
CREATE INDEX IF NOT EXISTS kml_cache_cache_key_idx ON public.kml_cache (cache_key);

-- Add expiry index on created_at to make cleaning up old entries easier
CREATE INDEX IF NOT EXISTS kml_cache_created_at_idx ON public.kml_cache (created_at);

-- Grant access to the anon role (to match existing permissions)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kml_cache TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.kml_cache_id_seq TO anon;
