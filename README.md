# Vergeside HTMX

A modern, client-side web application for tracking vergeside (bulk rubbish) pickup schedules in local councils. Built with HTML, CSS, JavaScript, HTMX, and Supabase.

## Features

- Interactive map showing vergeside pickup areas color-coded by pickup date
- Date range filtering to find upcoming pickups
- Council-specific filtering
- Contact form for inquiries or feedback
- Responsive design that works on mobile and desktop devices

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5
- **Interactive UI**: HTMX for dynamic content without complex JavaScript
- **Maps**: Google Maps API for visualization
- **Database**: Supabase (PostgreSQL)
- **Date Handling**: Moment.js and daterangepicker

## Setup Instructions

1. Clone this repository
2. Create a Supabase project at [supabase.com](https://supabase.com)
3. Set up the following tables in your Supabase project:
   - `councils` - Council information
   - `areas` - Areas within councils
   - `area_polygons` - Geographical boundaries for areas
   - `area_pickups` - Scheduled pickup dates
   - `contacts` - Contact form submissions
4. Update the `js/config.js` file with your Supabase URL and anonymous key
5. Update the Google Maps API key in `js/config.js` and the script tag in the HTML files
6. Deploy to a static hosting service (Netlify, Vercel, GitHub Pages, etc.)

## Database Schema

### councils
- id: UUID (primary key)
- name: Text
- description: Text
- website: Text

### areas
- id: UUID (primary key)
- name: Text
- council_id: UUID (foreign key to councils)

### area_polygons
- id: UUID (primary key)
- area_id: UUID (foreign key to areas)
- coordinates: JSONB (array of lat/lng points)

### area_pickups
- id: UUID (primary key)
- area_id: UUID (foreign key to areas)
- pickup_date: Date
- created_at: Timestamp

### contacts
- id: UUID (primary key)
- name: Text
- email: Text
- subject: Text
- message: Text
- created_at: Timestamp

## Local Development

For local development, you can run this application using any static file server:

```bash
# Using npm serve package
npx serve

# Using Python
python -m http.server 8000
```

## Deployment

This application can be deployed to any static hosting service:

1. Update configuration values for production
2. Build/optimize assets if needed
3. Deploy files to hosting service

## License

MIT