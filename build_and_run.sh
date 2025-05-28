#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status.

# build_and_run.sh
#
# This script manages the build and deployment process for the AION License Count application.
# It performs the following tasks:
# 1. Generates and updates build information
# 2. Creates a version.json file with build details
# 3. Stops and removes existing Docker containers
# 4. Optionally prunes Docker images and rebuilds containers
# 5. Starts or updates the Docker containers
#
# Usage: ./build_and_run.sh [--rebuild] [--prune]
#   --rebuild: Force rebuild of Docker images
#   --prune: Prune dangling Docker images before building

# Parse command line arguments
REBUILD=false
PRUNE=false

echo "Stopping and removing existing containers..."
if docker-compose ps --quiet 2>/dev/null | grep -q .; then
    docker-compose down --volumes
    echo "Containers stopped and removed."
else
    echo "No running containers found."
fi

# Process command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --rebuild) REBUILD=true ;;
        --prune) PRUNE=true ;;
        *) break ;;
    esac
    shift
done

# Prune Docker images if requested
if [ "$PRUNE" = true ]; then
    echo "Pruning dangling images..."
    docker image prune --force
fi

# Rebuild Docker images if requested
if [ "$REBUILD" = true ]; then
    echo "Rebuilding Docker images..."
    docker-compose build --no-cache
fi

echo "Starting or updating containers..."
docker-compose up --detach --build

echo "Operation completed."