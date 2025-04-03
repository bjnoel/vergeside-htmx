# Vergeside Pickup Map

A map of current and upcoming vergeside pickups in Perth, Western Australia.

## Mapping with Mapbox

This application uses Mapbox for mapping functionality. Previously it used Google Maps, but it has been migrated to Mapbox due to Google's API pricing changes.

### For Local Development

For browser-based local development, the token is set directly in the HTML:

1. Open `index.html`
2. Find the script block at the top with `window.MAPBOX_TOKEN`
3. Replace the value with your actual Mapbox token
4. This file should NOT be committed with your actual token

### For Production (Cloudflare Pages)

1. Add an environment variable named `MAPBOX_TOKEN` with your token value in the Cloudflare Pages dashboard
2. Configure this for your production/staging environments
3. The application will automatically use this environment variable when deployed

### Why This Approach

In a browser environment, `.env` files cannot be directly accessed without a build step. 
Since this is a static HTML site without a bundler, we use:

- Direct token setting in HTML for local development
- Environment variables for production deployments

### Security Best Practices

- Remove your token from index.html before committing changes
- Use different tokens for development vs. production
- For production, use a token with URL domain restrictions

## Local Development

To run the application locally:

1. Make sure you've configured your Mapbox token as described above
2. Open index.html in a web browser

## Notes

- The map will display an error message if the Mapbox token is missing or invalid
- If you need to update the map style, you can change it in the `MAP_STYLE` property in `config.js`
