# Script to setup Let's Encrypt certificates for FlappyCoin project
# This script follows the same approach as used in the TelegramStyle project

# Domain name
$DOMAIN = "flappy.keenetic.link"
$EMAIL = "herpbac9@gmail.com"  # Replace with your email

# Directory structure setup
Write-Host "Setting up directory structure for SSL certificates..."

# Create ssl directory if it doesn't exist
if (!(Test-Path "ssl")) {
    New-Item -Path "ssl" -ItemType Directory | Out-Null
    Write-Host "Created ssl directory"
}

# Create directory for ACME challenge
if (!(Test-Path "acme-challenge")) {
    New-Item -Path "acme-challenge" -ItemType Directory | Out-Null
    Write-Host "Created acme-challenge directory"
}

# Create a test file for validation
New-Item -Path "acme-challenge/test.txt" -ItemType File -Value "This is a test file for Let's Encrypt validation" -Force | Out-Null
Write-Host "Created test file for validation"

# Step 1: Generate temporary self-signed certificates
Write-Host "Generating temporary self-signed certificates..."

# Use Docker with Alpine to run OpenSSL commands
docker run --rm --volume ${PWD}:/work --workdir /work alpine sh -c "
    apk add --no-cache openssl &&
    openssl genrsa -out /work/ssl/key.pem 2048 &&
    openssl req -new -key /work/ssl/key.pem -out /work/ssl/csr.pem -subj '/CN=$DOMAIN/O=FlappyCoin/C=RU' &&
    openssl x509 -req -days 365 -in /work/ssl/csr.pem -signkey /work/ssl/key.pem -out /work/ssl/cert.pem &&
    rm /work/ssl/csr.pem"

Write-Host "Temporary self-signed certificates created"

# Step 2: Obtain Let's Encrypt certificates
Write-Host "Obtaining Let's Encrypt certificates..."
Write-Host "IMPORTANT: Make sure port 80 is forwarded to this machine and the domain '$DOMAIN' points to your IP address"
Write-Host "Your domain must be accessible from the internet for Let's Encrypt verification"

# Ask user if they want to proceed with Let's Encrypt certificate generation
Write-Host "Do you want to proceed with Let's Encrypt certificate generation? (Y/N)"
$proceed = Read-Host

if ($proceed -eq "Y" -or $proceed -eq "y") {
    # Use Certbot in Docker to obtain certificates
    Write-Host "Running Certbot to obtain certificates..."
    docker run -it --rm `
        -v "${PWD}/acme-challenge:/var/www/certbot/.well-known/acme-challenge" `
        -v "${PWD}/ssl:/etc/letsencrypt" `
        certbot/certbot certonly --webroot --webroot-path=/var/www/certbot `
        -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email

    # Check if certificates were successfully obtained
    if (Test-Path "ssl/live/$DOMAIN/fullchain.pem") {
        Write-Host "Let's Encrypt certificates successfully obtained!"
        Write-Host "Certificate files are located in ssl/live/$DOMAIN/"
        
        # List the certificate files
        Write-Host "Certificate files:"
        Get-ChildItem -Path "ssl/live/$DOMAIN" | Format-Table Name, Length, LastWriteTime
        
        # Update Nginx configuration if needed
        Write-Host "Don't forget to update your Nginx configuration to use these certificates:"
        Write-Host "SSL certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
        Write-Host "SSL key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
    } else {
        Write-Host "Error: Certificates were not generated. Check the output above for errors."
        Write-Host "Using self-signed certificates for now. You can try again later."
        
        # Display available files
        Write-Host "Current SSL files:"
        Get-ChildItem -Path "ssl" -Recurse | Format-Table FullName
    }
} else {
    Write-Host "Skipping Let's Encrypt certificate generation. Using self-signed certificates."
}

# Step 3: Update docker-compose.yml to include SSL configuration
Write-Host "Checking docker-compose.yml for SSL configuration..."

if (Test-Path "docker-compose.yml") {
    $dockerCompose = Get-Content -Path "docker-compose.yml" -Raw
    
    # Check if SSL configuration is already present
    if ($dockerCompose -match "443:443") {
        Write-Host "docker-compose.yml already contains SSL configuration"
    } else {
        Write-Host "You need to update docker-compose.yml to include SSL configuration"
        Write-Host "Example configuration for Nginx service:"
        Write-Host "  nginx:"
        Write-Host "    ports:"
        Write-Host "      - 80:80"
        Write-Host "      - 443:443"
        Write-Host "    volumes:"
        Write-Host "      - ./ssl:/etc/nginx/ssl"
        Write-Host "      - ./acme-challenge:/var/www/html/.well-known/acme-challenge"
    }
} else {
    Write-Host "Warning: docker-compose.yml not found. Make sure to create it with proper SSL configuration."
}

Write-Host "Done! Your SSL certificates are set up." 