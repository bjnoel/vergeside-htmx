// Test script to directly interact with the KML cache in Supabase
// Run this with Node.js: node test-kml-cache.js

const { createClient } = require('@supabase/supabase-js');

// Replace these with your actual Supabase URL and service role key
const SUPABASE_URL = 'your-supabase-url';
const SUPABASE_SERVICE_KEY = 'your-service-role-key'; // Use service role key for admin access

// Create a Supabase client with the service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log('Testing KML cache functionality...');

    try {
        // Step 1: Check if the kml_cache table exists
        console.log('Checking if kml_cache table exists...');
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'kml_cache');

        if (tableError) {
            throw new Error(`Error checking for table: ${tableError.message}`);
        }

        if (!tables || tables.length === 0) {
            console.log('kml_cache table does not exist!');
            console.log('Creating kml_cache table...');

            // Create the table
            const createTableSQL = `
                CREATE TABLE public.kml_cache (
                    id SERIAL PRIMARY KEY,
                    cache_key TEXT NOT NULL UNIQUE,
                    kml_content TEXT NOT NULL,
                    parameters JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                ALTER TABLE public.kml_cache ENABLE ROW LEVEL SECURITY;
                
                CREATE POLICY "Anyone can read cache" ON public.kml_cache 
                    FOR SELECT USING (true);
                    
                CREATE POLICY "Anyone can insert cache" ON public.kml_cache 
                    FOR INSERT WITH CHECK (true);
                    
                CREATE POLICY "Anyone can update cache" ON public.kml_cache 
                    FOR UPDATE USING (true);
                    
                CREATE POLICY "Anyone can delete cache" ON public.kml_cache 
                    FOR DELETE USING (true);
                
                GRANT SELECT, INSERT, UPDATE, DELETE ON public.kml_cache TO anon, authenticated;
                GRANT USAGE, SELECT ON SEQUENCE public.kml_cache_id_seq TO anon, authenticated;
            `;

            const { error: createError } = await supabase.rpc('pgclient', { query: createTableSQL });
            
            if (createError) {
                throw new Error(`Error creating table: ${createError.message}`);
            }
            
            console.log('kml_cache table created successfully!');
        } else {
            console.log('kml_cache table exists!');
        }

        // Step 2: Test inserting data into the table
        console.log('Testing cache insert...');
        
        const testData = {
            cache_key: 'test-key-' + Date.now(),
            kml_content: '<kml><Document><n>Test KML</n></Document></kml>',
            parameters: { test: true, date: new Date().toISOString() },
            created_at: new Date().toISOString()
        };
        
        console.log('Inserting test data:', testData);
        
        const { data: insertData, error: insertError } = await supabase
            .from('kml_cache')
            .insert([testData])
            .select();
        
        if (insertError) {
            throw new Error(`Error inserting data: ${insertError.message}`);
        }
        
        console.log('Insert successful!', insertData);

        // Step 3: Test retrieving data from the table
        console.log('Testing cache retrieval...');
        
        const { data: retrieveData, error: retrieveError } = await supabase
            .from('kml_cache')
            .select('*')
            .eq('cache_key', testData.cache_key)
            .single();
        
        if (retrieveError) {
            throw new Error(`Error retrieving data: ${retrieveError.message}`);
        }
        
        console.log('Retrieval successful!', retrieveData);

        // Step 4: List all cache entries
        console.log('Listing all cache entries...');
        
        const { data: allEntries, error: listError } = await supabase
            .from('kml_cache')
            .select('id, cache_key, parameters, created_at')
            .order('created_at', { ascending: false });
        
        if (listError) {
            throw new Error(`Error listing cache entries: ${listError.message}`);
        }
        
        console.log(`Found ${allEntries.length} cache entries:`);
        allEntries.forEach(entry => {
            console.log(`- ID: ${entry.id}, Key: ${entry.cache_key}, Created: ${entry.created_at}`);
        });

        console.log('All tests completed successfully!');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

main();
