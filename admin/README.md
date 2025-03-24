# Vergeside Admin CMS

This directory contains the administration interface for the Vergeside website. It allows authorized administrators to manage councils, areas, and pickup schedules.

## Setup Instructions

### 1. Database Setup

Run the SQL in `setup-admin-db.sql` in your Supabase SQL Editor to:
- Create the admin_users table
- Set up proper Row Level Security (RLS) policies
- Insert your admin email addresses

### 2. Auth0 Configuration

1. Create an Auth0 account if you don't have one
2. Create a new Auth0 application
   - Name: Vergeside Admin
   - Application Type: Regular Web Application
3. Configure the Auth0 application:
   - Allowed Callback URLs: `https://yourdomain.com/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for development)
   - Allowed Logout URLs: `https://yourdomain.com` (and `http://localhost:3000` for development)
   - Allowed Web Origins: `https://yourdomain.com` (and `http://localhost:3000` for development)
4. Set up Auth0 connection with Supabase (follow Auth0's documentation)

### 3. Environment Variables

Create a `.env` file in the root directory with the following variables:
```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_CALLBACK_URL=http://localhost:3000/api/auth/callback
```

### 4. Install Dependencies

```bash
npm install @supabase/supabase-js dotenv
```

### 5. Start the Server

```bash
npm start
```

## Admin Pages

- `/admin/index.html` - Admin Dashboard
- `/admin/councils.html` - Manage Councils
- `/admin/areas.html` - Manage Areas (future implementation)
- `/admin/pickups.html` - Manage Pickups (future implementation)

## Security

The admin interface is secured by:
1. Auth0 authentication
2. Whitelist checking against the `admin_users` table
3. Row Level Security (RLS) policies in Supabase

Only users with emails in the `admin_users` table will be granted access to modify data.
