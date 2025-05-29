# Dockerfile for AION License Count application

# Use Node.js LTS version
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

EXPOSE 3001

# Command to run the application
CMD ["node", "server.js"]

