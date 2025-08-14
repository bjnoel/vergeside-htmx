-- Update email_send_log table to match edge function requirements
-- Drop the old table structure and recreate with correct schema

-- First, drop existing constraints and table
DROP TABLE IF EXISTS email_send_log CASCADE;

-- Recreate email_send_log table with correct structure for bulk email sending
CREATE TABLE email_send_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_type VARCHAR(50) NOT NULL DEFAULT 'weekly' CHECK (email_type IN ('weekly', 'test', 'manual')),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_email_send_log_sent_at ON email_send_log(sent_at);
CREATE INDEX idx_email_send_log_status ON email_send_log(status);
CREATE INDEX idx_email_send_log_type ON email_send_log(email_type);

-- Create RLS policies
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Policy for service role to manage email logs (needed for edge functions)
CREATE POLICY "Service role can manage email logs" ON email_send_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for authenticated users to view email logs (admin only)
CREATE POLICY "Admin can view email logs" ON email_send_log
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy for authenticated users to insert email logs (admin only - for manual logging)
CREATE POLICY "Admin can insert email logs" ON email_send_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE email_send_log IS 'Logs bulk email sending attempts for weekly vergeside notifications';
COMMENT ON COLUMN email_send_log.email_type IS 'Type of email sent: weekly (scheduled), test, or manual';
COMMENT ON COLUMN email_send_log.recipient_count IS 'Number of recipients for this email send';
COMMENT ON COLUMN email_send_log.status IS 'Email delivery status: sent, failed, or pending';
COMMENT ON COLUMN email_send_log.error_message IS 'Error details if the email send failed';
COMMENT ON COLUMN email_send_log.metadata IS 'Additional metadata about the email send (JSON)';
COMMENT ON COLUMN email_send_log.sent_at IS 'Timestamp when the email was sent or attempted';

-- Insert sample log entry to help with testing
INSERT INTO email_send_log (email_type, recipient_count, status, sent_at, metadata) VALUES
    ('test', 1, 'sent', NOW() - INTERVAL '1 hour', '{"test": true, "sample": "data"}'),
    ('weekly', 0, 'pending', NOW() - INTERVAL '7 days', '{"scheduled": true}');