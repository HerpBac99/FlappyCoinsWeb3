# Docker restart script

# Prepare directories
Write-Host "Preparing directories..."
./prepare-docker.ps1

# Stop containers
Write-Host "Stopping containers..."
docker-compose down

# Clean up
Write-Host "Cleaning up..."
docker system prune -f

# Build
Write-Host "Building images..."
docker-compose build --no-cache

# Start
Write-Host "Starting containers..."
docker-compose up 