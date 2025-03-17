// Direct database access script for diagnosing cache issues
// Run with browser console or Node.js

async function diagnoseKmlCacheIssues() {
    console.log('============================================');
    console.log('DIAGNOSING KML CACHE ISSUES');
    console.log('============================================');
    
    try {
        // 1. Check if the table exists
        console.log('1. Checking if kml_cache table exists...');
        
        let tableExists = false;
        try {
            const { count, error } = await supabaseClient.supabase
                .from('kml_cache')
                .select('*', { count: 'exact', head: true });
                
            if (error) {
                console.error('Error querying kml_cache table:', error);
                tableExists = false;
            } else {
                console.log(`Table exists with ${count} entries`);
                tableExists = true;
            }
        } catch (e) {
            console.error('Error checking for table (likely doesn\'t exist):', e);
            tableExists = false;
        }
        
        if (!tableExists) {
            console.log('Table does not exist or cannot be accessed.');
            console.log('CREATING TABLE NOW...');
            
            try {
                // Try to create the table using the SQL function
                const createTableSQL = `
                CREATE TABLE IF NOT EXISTS public.kml_cache (
                    id SERIAL PRIMARY KEY,
                    cache_key TEXT NOT NULL UNIQUE,
                    kml_content TEXT NOT NULL,
                    parameters JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
                    
                -- Grant permissions to anon and authenticated roles
                GRANT SELECT, INSERT, UPDATE, DELETE ON public.kml_cache TO anon, authenticated;
                GRANT USAGE, SELECT ON SEQUENCE public.kml_cache_id_seq TO anon, authenticated;
                `;
                
                // This requires superuser privileges which anon/auth users typically don't have
                // You'll need to run this SQL in the Supabase SQL editor
                console.log('IMPORTANT: You need to run the create-kml-cache-table.sql script in the Supabase SQL editor');
                console.log('See the create-kml-cache-table.sql file for the SQL to run');
            } catch (createError) {
                console.error('Error creating table:', createError);
            }
            
            return;
        }
        
        // 2. Test insertion permissions
        console.log('\n2. Testing insert permissions...');
        
        const testKey = `test-key-${Date.now()}`;
        const testContent = '<kml><Document><name>Test</name></Document></kml>';
        
        try {
            const { data, error } = await supabaseClient.supabase
                .from('kml_cache')
                .insert([{
                    cache_key: testKey,
                    kml_content: testContent,
                    parameters: { test: true },
                    created_at: new Date().toISOString()
                }])
                .select();
                
            if (error) {
                console.error('INSERT FAILED:', error);
                console.log('PERMISSIONS ISSUE DETECTED');
                
                // Check the policies
                console.log('\nChecking policies...');
                try {
                    // This requires admin access which you likely don't have from the browser
                    console.log('IMPORTANT: You need to check the policies manually in the Supabase dashboard');
                    console.log('Make sure there are policies allowing INSERT, SELECT, UPDATE and DELETE');
                } catch (e) {
                    console.error('Error checking policies:', e);
                }
            } else {
                console.log('INSERT SUCCESSFUL!', data);
                
                // 3. Test retrieval
                console.log('\n3. Testing retrieval...');
                
                try {
                    const { data: retrievedData, error: retrieveError } = await supabaseClient.supabase
                        .from('kml_cache')
                        .select('*')
                        .eq('cache_key', testKey)
                        .single();
                        
                    if (retrieveError) {
                        console.error('RETRIEVAL FAILED:', retrieveError);
                    } else {
                        console.log('RETRIEVAL SUCCESSFUL!', retrievedData);
                        
                        // 4. Test deletion
                        console.log('\n4. Testing deletion...');
                        
                        const { error: deleteError } = await supabaseClient.supabase
                            .from('kml_cache')
                            .delete()
                            .eq('cache_key', testKey);
                            
                        if (deleteError) {
                            console.error('DELETION FAILED:', deleteError);
                        } else {
                            console.log('DELETION SUCCESSFUL!');
                        }
                    }
                } catch (e) {
                    console.error('Error in retrieval test:', e);
                }
            }
        } catch (e) {
            console.error('Error in insertion test:', e);
        }
        
        // 5. List all existing entries
        console.log('\n5. Listing all cache entries...');
        
        try {
            const { data, error } = await supabaseClient.supabase
                .from('kml_cache')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) {
                console.error('Error listing cache entries:', error);
            } else {
                console.log(`Found ${data.length} entries:`);
                data.forEach(entry => {
                    console.log(`- Key: ${entry.cache_key}, Created: ${entry.created_at}`);
                });
            }
        } catch (e) {
            console.error('Error listing cache entries:', e);
        }
        
        console.log('\nDiagnosis complete!');
        
    } catch (err) {
        console.error('General diagnosis error:', err);
    }
}

// Run the diagnosis
// If in browser, make sure this runs after supabaseClient is initialized
if (typeof window !== 'undefined') {
    // In browser
    if (typeof supabaseClient !== 'undefined') {
        diagnoseKmlCacheIssues();
    } else {
        console.error('supabaseClient not found. Make sure this script runs after supabase-client.js');
    }
} else {
    // In Node.js
    console.log('This script is meant to be run in the browser with the Supabase client initialized');
}
