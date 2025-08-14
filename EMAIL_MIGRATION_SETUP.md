# Email Migration Setup Guide

This guide walks you through setting up the new email subscription system for Vergeside using Supabase Edge Functions and Resend.

## Prerequisites

1. **Supabase Project** with the following enabled:
   - Edge Functions
   - pg_cron extension
   - pg_net extension

2. **Resend Account** with API key

3. **Supabase CLI** installed locally for deployment

## Setup Steps

### 1. Database Migration

Run the database migrations to create the required tables:

```sql
-- Apply migration files in order
\i supabase/migrations/001_email_subscribers.sql
\i supabase/migrations/002_setup_cron.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

### 2. Environment Variables

Set up the following environment variables in your Supabase project:

#### In Supabase Dashboard > Project Settings > API:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Your anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

#### In Supabase Dashboard > Edge Functions > Settings:
- `RESEND_API_KEY`: Your Resend API key

### 3. Deploy Edge Functions

Deploy the email functions to Supabase:

```bash
# Navigate to your project directory
cd /path/to/vergeside-htmx

# Deploy the send-weekly-emails function
supabase functions deploy send-weekly-emails

# Deploy the test-email function  
supabase functions deploy test-email
```

### 4. Configure Cron Job Settings

Update the cron job configuration with your actual Supabase URL and service role key:

```sql
SELECT update_cron_settings(
    'https://your-project-ref.supabase.co',
    'your-service-role-key-here'
);
```

### 5. Test the System

#### Test Email Function
```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/test-email \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

#### Test Weekly Email Function (Manual Trigger)
```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-weekly-emails \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{"manual": true}'
```

### 6. Add Sample Subscribers

You can add subscribers through the admin UI at `/admin/subscribers` or directly via SQL:

```sql
INSERT INTO email_subscribers (name, email, is_active) VALUES
    ('Test User', 'test@example.com', true),
    ('Admin User', 'admin@yourdomain.com', true);
```

### 7. Monitor Cron Job

Check if the cron job is properly scheduled:

```sql
SELECT * FROM get_cron_job_status();
```

View cron job execution history:

```sql
SELECT * FROM cron_job_history;
```

## Admin Interface

The admin interface is available at `/admin/subscribers` and provides:

- ✅ View all email subscribers
- ✅ Add/edit/delete subscribers
- ✅ Bulk operations (activate, deactivate, delete)
- ✅ Import subscribers from CSV
- ✅ Export subscribers to CSV
- ✅ Test email functionality
- ✅ View email sending history

## Email Scheduling

- **Weekly emails** are sent every **Thursday at 8:00 AM UTC**
- **Content includes** pickup areas scheduled for the following week (Sunday to Sunday)
- **Maps are embedded** as images from the existing API endpoints
- **Bulk waste links** are included when available from council data

## Testing

### Quick Test via Admin UI
1. Navigate to `/admin/subscribers`
2. Click the "Test Weekly Email" button
3. The test will be sent to your admin email address

### Custom Test Email
1. Use the test email modal in the subscribers page
2. Enter any email address to receive a test
3. Choose current or next week's data

## Troubleshooting

### Common Issues

1. **Cron job not running**
   - Check if pg_cron extension is enabled
   - Verify the cron job status with `SELECT * FROM get_cron_job_status();`
   - Check if the Supabase URL and service role key are correctly set

2. **Emails not sending**
   - Verify Resend API key is set correctly
   - Check the email send log: `SELECT * FROM email_send_log ORDER BY sent_at DESC;`
   - Test the Resend API key manually

3. **No pickup data**
   - Verify that area_pickup table has data for next week
   - Check if areas have associated councils with bulk_waste_url

4. **Authentication errors**
   - Ensure the service role key has proper permissions
   - Check if RLS policies are correctly configured

### Debugging

View recent email logs:
```sql
SELECT 
    esl.*,
    es.name,
    es.email
FROM email_send_log esl
JOIN email_subscribers es ON esl.subscriber_id = es.id
ORDER BY esl.sent_at DESC
LIMIT 10;
```

Check for failed emails:
```sql
SELECT COUNT(*) as failed_count
FROM email_send_log 
WHERE status = 'failed' 
AND sent_at > NOW() - INTERVAL '7 days';
```

## Migration from Legacy System

When you're ready to switch from the legacy .NET emailer:

1. **Parallel Testing**: Run both systems in parallel for a few weeks
2. **Data Migration**: Export existing subscribers and import to new system
3. **Monitor**: Check email delivery rates and user feedback
4. **Switch Over**: Disable the legacy Windows service
5. **Cleanup**: Remove legacy code and infrastructure

## Backup and Recovery

### Backup Subscribers
```sql
COPY email_subscribers TO '/path/to/backup/subscribers.csv' DELIMITER ',' CSV HEADER;
```

### Restore Subscribers
```sql
COPY email_subscribers FROM '/path/to/backup/subscribers.csv' DELIMITER ',' CSV HEADER;
```

## Performance Notes

- The system handles up to 1000 subscribers efficiently
- For larger lists, consider implementing batch sending in the Edge Function
- Email send logs are automatically cleaned up (only last 30 days shown in history view)
- Consider implementing unsubscribe functionality if list grows large

## Next Steps

After successful deployment:

1. **Monitor delivery rates** for the first few weeks
2. **Collect user feedback** on email format and timing
3. **Consider additional features** like unsubscribe links, email preferences
4. **Implement analytics** to track open rates (if needed)
5. **Scale up** if subscriber base grows significantly