# Use Node.js 22 as the base image (matches Cloud Run's base image)
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the Angular application
RUN npm run build

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
