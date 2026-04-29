# Minimal Dockerfile for school-management-system
# Uses a small official Node image and runs the existing start script
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (cacheable)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Use production env by default; override in your platform if needed
ENV NODE_ENV=production

# Port used by the app (match PORT or default 5000)
EXPOSE 5000

# Start the app using the existing npm start script
CMD ["node", "server.js"]
