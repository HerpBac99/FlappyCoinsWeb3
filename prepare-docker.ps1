# Скрипт для подготовки необходимых директорий перед запуском Docker
# Создает директории ssl и acme-challenge, если они не существуют

# Создание директории ssl, если не существует
if (-not (Test-Path -Path "./ssl")) {
    Write-Host "Creating ssl directory..."
    New-Item -ItemType Directory -Path "./ssl"
} else {
    Write-Host "SSL directory already exists."
}

# Создание директории acme-challenge для Let's Encrypt, если не существует
if (-not (Test-Path -Path "./acme-challenge")) {
    Write-Host "Creating acme-challenge directory..."
    New-Item -ItemType Directory -Path "./acme-challenge"
} else {
    Write-Host "acme-challenge directory already exists."
}

# Создаем тестовый файл в директории acme-challenge для проверки
$testPath = "./acme-challenge/test.txt"
if (-not (Test-Path -Path $testPath)) {
    Write-Host "Creating test file in acme-challenge directory..."
    Set-Content -Path $testPath -Value "This is a test file for Let's Encrypt ACME challenge."
} else {
    Write-Host "Test file already exists in acme-challenge directory."
}

Write-Host "Docker preparation completed successfully." 