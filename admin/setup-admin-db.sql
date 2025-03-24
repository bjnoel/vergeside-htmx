-- Admin users whitelist table - run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in TIMESTAMP WITH TIME ZONE
);

-- Insert your admin emails - replace with your actual email addresses
INSERT INTO admin_users (email) VALUES 
  ('your-email@example.com'),
  ('other-admin@example.com');

-- Create a secure Row Level Security (RLS) policy
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only allow admin users to view the admin_users table
CREATE POLICY admin_users_policy ON admin_users
  USING (email = auth.jwt() ->> 'email');

-- You may also want to update RLS policies on your data tables to only allow writes from admin users
-- Here's an example for the council table:

-- Anyone can read council data
CREATE POLICY council_select_policy ON council
  FOR SELECT USING (true);

-- Only admins can insert/update/delete council data
CREATE POLICY council_insert_policy ON council
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY council_update_policy ON council
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY council_delete_policy ON council
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

-- Area table policies
CREATE POLICY area_select_policy ON area
  FOR SELECT USING (true);

CREATE POLICY area_insert_policy ON area
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY area_update_policy ON area
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY area_delete_policy ON area
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

-- Area polygon table policies
CREATE POLICY area_polygon_select_policy ON area_polygon
  FOR SELECT USING (true);

CREATE POLICY area_polygon_insert_policy ON area_polygon
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY area_polygon_update_policy ON area_polygon
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY area_polygon_delete_policy ON area_polygon
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

-- Area pickup table policies
CREATE POLICY area_pickup_select_policy ON area_pickup
  FOR SELECT USING (true);

CREATE POLICY area_pickup_insert_policy ON area_pickup
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY area_pickup_update_policy ON area_pickup
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY area_pickup_delete_policy ON area_pickup
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'
  ));
