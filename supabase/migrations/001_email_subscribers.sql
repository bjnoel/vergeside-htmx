-- Create email subscribers table
CREATE TABLE IF NOT EXISTS email_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email send log table
CREATE TABLE IF NOT EXISTS email_send_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscriber_id UUID REFERENCES email_subscribers(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    email_content JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_email_subscribers_active ON email_subscribers(is_active);
CREATE INDEX idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX idx_email_send_log_subscriber ON email_send_log(subscriber_id);
CREATE INDEX idx_email_send_log_sent_at ON email_send_log(sent_at);
CREATE INDEX idx_email_send_log_status ON email_send_log(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for email_subscribers
CREATE TRIGGER update_email_subscribers_updated_at 
    BEFORE UPDATE ON email_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read subscribers (admin only)
CREATE POLICY "Admin can view subscribers" ON email_subscribers
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy for authenticated users to insert subscribers (admin only)
CREATE POLICY "Admin can insert subscribers" ON email_subscribers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy for authenticated users to update subscribers (admin only)
CREATE POLICY "Admin can update subscribers" ON email_subscribers
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for authenticated users to delete subscribers (admin only)
CREATE POLICY "Admin can delete subscribers" ON email_subscribers
    FOR DELETE
    TO authenticated
    USING (true);

-- Policy for service role to view email logs
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

-- Insert some sample data for testing (optional - comment out for production)
-- INSERT INTO email_subscribers (email, name, is_active) VALUES
--     ('admin@example.com', 'Admin User', true),
--     ('test@example.com', 'Test User', true);

-- Add comments for documentation
COMMENT ON TABLE email_subscribers IS 'Stores email subscribers for weekly vergeside notifications';
COMMENT ON TABLE email_send_log IS 'Logs all email sending attempts with status and error tracking';
COMMENT ON COLUMN email_subscribers.is_active IS 'Whether the subscriber should receive emails';
COMMENT ON COLUMN email_send_log.status IS 'Email delivery status: sent, failed, or pending';
COMMENT ON COLUMN email_send_log.email_content IS 'JSON content of the email for debugging purposes';