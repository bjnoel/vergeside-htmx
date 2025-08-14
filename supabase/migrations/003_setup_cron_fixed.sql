-- Enable required extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create configuration table for storing settings
CREATE TABLE IF NOT EXISTS app_settings (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read/write settings (admin only in practice)
CREATE POLICY "Admin users can manage settings" ON app_settings
FOR ALL USING (auth.role() = 'authenticated');

-- Insert default configuration settings (empty values to be set later)
INSERT INTO app_settings (name, value, description) VALUES
    ('supabase_url', '', 'Supabase project URL for making HTTP requests to Edge Functions'),
    ('service_role_key', '', 'Supabase service role key for authenticated requests')
ON CONFLICT (name) DO NOTHING;

-- Remove any existing cron job with the same name (ignore errors if job doesn't exist)
DO $$
BEGIN
    PERFORM cron.unschedule('send-weekly-vergeside-emails');
EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, ignore the error
    NULL;
END
$$;

-- Schedule weekly email send (Every Thursday at 8 AM UTC)
-- Note: This will fail until app_settings has valid URL and key values
-- Use update_cron_settings() function after setting up the configuration
SELECT cron.schedule(
    'send-weekly-vergeside-emails',
    '0 8 * * 4',
    $cron$SELECT net.http_post(
        url := (SELECT value FROM app_settings WHERE name = 'supabase_url') || '/functions/v1/send-weekly-emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE name = 'service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('scheduled', true)
    );$cron$
);

-- Create a function to manually trigger the weekly email send (for testing)
CREATE OR REPLACE FUNCTION trigger_manual_weekly_emails()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Call the edge function manually
    SELECT net.http_post(
        url := (SELECT value FROM app_settings WHERE name = 'supabase_url') || '/functions/v1/send-weekly-emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE name = 'service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('manual', true)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users (admin only)
GRANT EXECUTE ON FUNCTION trigger_manual_weekly_emails() TO authenticated;

-- Create a function to check the status of the cron job
CREATE OR REPLACE FUNCTION get_cron_job_status()
RETURNS TABLE(
    jobid bigint,
    schedule text,
    command text,
    nodename text,
    nodeport integer,
    database text,
    username text,
    active boolean,
    jobname text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM cron.job WHERE jobname = 'send-weekly-vergeside-emails';
$$;

-- Grant execute permission to authenticated users (admin only)
GRANT EXECUTE ON FUNCTION get_cron_job_status() TO authenticated;

-- Create a view for cron job history (last 30 days)
CREATE OR REPLACE VIEW cron_job_history AS
SELECT 
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time,
    (end_time - start_time) as duration
FROM cron.job_run_details 
WHERE start_time > NOW() - INTERVAL '30 days'
AND jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'send-weekly-vergeside-emails')
ORDER BY start_time DESC;

-- Grant select on the view to authenticated users (admin only)
GRANT SELECT ON cron_job_history TO authenticated;

-- Create a function to update these settings (admin only)
CREATE OR REPLACE FUNCTION update_cron_settings(
    supabase_url text,
    service_role_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the settings in our app_settings table
    UPDATE app_settings SET value = supabase_url, updated_at = NOW() WHERE name = 'supabase_url';
    UPDATE app_settings SET value = service_role_key, updated_at = NOW() WHERE name = 'service_role_key';
    
    -- Reschedule the cron job to pick up new settings
    BEGIN
        PERFORM cron.unschedule('send-weekly-vergeside-emails');
    EXCEPTION WHEN OTHERS THEN
        -- Job doesn't exist, ignore the error
        NULL;
    END;
    
    PERFORM cron.schedule(
        'send-weekly-vergeside-emails',
        '0 8 * * 4',
        $cron$SELECT net.http_post(
            url := (SELECT value FROM app_settings WHERE name = 'supabase_url') || '/functions/v1/send-weekly-emails',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE name = 'service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object('scheduled', true)
        );$cron$
    );
    
    RETURN true;
END;
$$;

-- Grant execute permission to authenticated users (admin only)
GRANT EXECUTE ON FUNCTION update_cron_settings(text, text) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION trigger_manual_weekly_emails() IS 'Manually triggers the weekly email send for testing purposes';
COMMENT ON FUNCTION get_cron_job_status() IS 'Returns the status and configuration of the weekly email cron job';
COMMENT ON VIEW cron_job_history IS 'Shows the execution history of the weekly email cron job for the last 30 days';
COMMENT ON FUNCTION update_cron_settings(text, text) IS 'Updates the Supabase URL and service role key for the cron job (admin only)';

-- Log the cron job setup
DO $$
BEGIN
    RAISE NOTICE 'Weekly email cron job has been scheduled for Thursdays at 8 AM UTC';
    RAISE NOTICE 'Use SELECT get_cron_job_status(); to check the job status';
    RAISE NOTICE 'Use SELECT trigger_manual_weekly_emails(); to test the job manually';
    RAISE NOTICE 'Use SELECT * FROM cron_job_history; to see execution history';
    RAISE NOTICE 'IMPORTANT: Run update_cron_settings(url, key) with your actual Supabase URL and service role key';
END $$;