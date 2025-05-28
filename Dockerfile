# Dockerfile for AION License Count application

# Use Python 3.12.3 with Bullseye as the base image
FROM node:23.7

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY package*.json ./
RUN npm install

# Copy the rest of the application code into the container
COPY / .

EXPOSE 3001

# Command to run the application using Gunicorn
# -w 4: Use 4 worker processes
# -b 0.0.0.0:5000: Bind to all interfaces on port 5000
CMD ["node", "server.js"]

