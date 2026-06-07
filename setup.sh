#!/bin/bash
echo "Setting up Neon Syndicate Multiplayer Environment..."

# Create public directory for frontend files
echo "Organizing frontend files..."
mkdir -p public
mv index.html style.css game.js constants.js public/ 2>/dev/null || true

# Install dependencies
echo "Installing Node.js packages..."
npm install

# Start the server
echo "Starting the server on port 3000..."
npm start
