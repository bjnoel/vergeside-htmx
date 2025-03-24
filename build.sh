#!/bin/bash

# Simple build script for Cloudflare Pages
# This will replace environment variable placeholders in env-config.js

echo "Starting build process..."

# Replace environment variables in env-config.js
if [ -f "js/env-config.js" ]; then
  echo "Injecting environment variables into env-config.js"
  
  # Check if MAPS_API_KEY is set
  if [ -n "$MAPS_API_KEY" ]; then
    echo "Injecting MAPS_API_KEY"
    sed -i "s/\${MAPS_API_KEY}/$MAPS_API_KEY/g" js/env-config.js
  else
    echo "Warning: MAPS_API_KEY environment variable is not set"
  fi
  
  # Add more environment variables as needed here
  
else
  echo "Warning: js/env-config.js not found"
fi

echo "Build completed successfully"
exit 0
