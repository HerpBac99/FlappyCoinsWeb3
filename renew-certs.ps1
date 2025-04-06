# Script to renew Let's Encrypt certificates for FlappyCoin project
# Run this script periodically (e.g., monthly) to ensure certificates are up-to-date

# Domain name
$DOMAIN = "flappy.keenetic.link"

# Check if ssl directory exists
if (!(Test-Path "ssl")) {
    Write-Host "Error: ssl directory not found. Please run setup-letsencrypt.ps1 first."
    exit 1
}

# Check if acme-challenge directory exists
if (!(Test-Path "acme-challenge")) {
    Write-Host "Error: acme-challenge directory not found. Please run setup-letsencrypt.ps1 first."
    exit 1
}

# Renew certificates
Write-Host "Renewing Let's Encrypt certificates..."
Write-Host "IMPORTANT: Make sure port 80 is forwarded to this machine and the domain '$DOMAIN' points to your IP address"

# Use Certbot in Docker to renew certificates
Write-Host "Running Certbot to renew certificates..."
docker run --rm `
    -v "${PWD}/acme-challenge:/var/www/certbot/.well-known/acme-challenge" `
    -v "${PWD}/ssl:/etc/letsencrypt" `
    certbot/certbot renew --webroot --webroot-path=/var/www/certbot

# Check if renewal was successful
if (Test-Path "ssl/live/$DOMAIN/fullchain.pem") {
    # Get certificate expiration date
    $certInfo = docker run --rm -v "${PWD}/ssl:/etc/letsencrypt" alpine sh -c "apk add --no-cache openssl && openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    
    Write-Host "Certificate information:"
    Write-Host $certInfo
    
    # Show certificate files
    Write-Host "Certificate files:"
    Get-ChildItem -Path "ssl/live/$DOMAIN" | Format-Table Name, Length, LastWriteTime
    
    Write-Host "Certificate renewal process completed. Make sure to restart your Nginx container to apply any new certificates."
    Write-Host "You can restart your containers using: docker-compose restart nginx"
} else {
    Write-Host "Error: Certificate renewal failed or certificates not found."
    Write-Host "Check if your domain is properly configured and accessible from the internet."
    Write-Host "You may need to run setup-letsencrypt.ps1 again to generate new certificates."
}

Write-Host "Done!" 