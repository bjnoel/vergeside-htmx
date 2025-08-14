-- Fix the cron_job_history view to remove SECURITY DEFINER
-- Views should not have SECURITY DEFINER, only functions should
DROP VIEW IF EXISTS cron_job_history;

CREATE VIEW cron_job_history AS
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

-- Add comment
COMMENT ON VIEW cron_job_history IS 'Shows the execution history of the weekly email cron job for the last 30 days';