-- Create a table to store KML cache entries
CREATE TABLE IF NOT EXISTS public.kml_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  kml_content TEXT NOT NULL,
  parameters JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add index on cache_key for faster lookups
  CONSTRAINT kml_cache_key_idx UNIQUE (cache_key)
);

-- Add RLS policies for the cache table
ALTER TABLE public.kml_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cache
CREATE POLICY "Anyone can read cache" ON public.kml_cache 
  FOR SELECT USING (true);
  
-- Allow authenticated users to insert cache
CREATE POLICY "Anyone can insert cache" ON public.kml_cache 
  FOR INSERT WITH CHECK (true);
  
-- Allow authenticated users to update cache
CREATE POLICY "Anyone can update cache" ON public.kml_cache 
  FOR UPDATE USING (true);
  
-- Allow authenticated users to delete cache
CREATE POLICY "Anyone can delete cache" ON public.kml_cache 
  FOR DELETE USING (true);

-- Create an index on created_at to make it easier to clean up old cache entries
CREATE INDEX IF NOT EXISTS kml_cache_created_at_idx ON public.kml_cache (created_at);

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kml_cache TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.kml_cache_id_seq TO anon, authenticated;
