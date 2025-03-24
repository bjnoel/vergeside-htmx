# Vergeside HTMX

A modern implementation of the Vergeside pickup map using HTMX and Supabase.

## Environment Variables

This project uses environment variables for configuration. When deploying to Cloudflare Pages, you'll need to set the following environment variables:

### Required Environment Variables

- `MAPS_API_KEY`: Your Google Maps API key

### Setting Up Environment Variables in Cloudflare Pages

1. Go to your Cloudflare Pages project
2. Navigate to Settings > Environment variables
3. Add the variable `MAPS_API_KEY` with your Google Maps API key
4. Make sure to set it for both Production and Preview environments

Cloudflare Pages will automatically inject these variables during the build process.

## Development Setup

For local development, you can edit the values directly in `js/config.js` or create a local `.env` file.

## Deployment

When deploying to Cloudflare Pages:

1. Connect your GitHub repository
2. Use the following build settings:
   - Build command: `npm run build` (if you have a build step, otherwise leave blank)
   - Build output directory: `/` (or your output directory if using a build tool)
3. Set up the required environment variables as mentioned above

## Project Structure

- `/js` - JavaScript files
  - `config.js` - Configuration file that reads environment variables
  - `env-config.js` - Helper file for injecting environment variables
  - `supabase-client.js` - Supabase client integration
- `/css` - Stylesheets
- `/images` - Site images and assets
