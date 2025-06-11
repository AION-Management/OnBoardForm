# Dockerfile for AION License Count application

# Use Node.js LTS version with Python
FROM node:20-slim

# Install Python and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-requests \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Make the processing script executable
RUN chmod +x process_submissions.sh

EXPOSE 3001

# Command to run the application
CMD ["node", "server.js"]

