# WebForge AI - Windows Setup Script
# Run this in PowerShell

Write-Host "🚀 WebForge AI - Windows Setup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "✓ Node.js $nodeVersion detected" -ForegroundColor Green
    
    # Check version is 18 or higher
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 18) {
        Write-Host "✗ Node.js version must be 18 or higher" -ForegroundColor Red
        Write-Host "Current version: $nodeVersion" -ForegroundColor Red
        Write-Host "Please download from https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js 18 or higher from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm -v
    Write-Host "✓ npm $npmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "✗ npm is not installed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Set up environment file
if (-Not (Test-Path ".env")) {
    Write-Host "⚙️ Setting up environment file..." -ForegroundColor Yellow
    
    # Create .env file
    @"
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding utf8
    
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️ IMPORTANT: You need to add your Anthropic API key to .env" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "Do you have your Anthropic API key ready? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host ""
        $apiKey = Read-Host "Enter your Anthropic API key"
        (Get-Content ".env") -replace 'your_anthropic_api_key_here', $apiKey | Set-Content ".env"
        Write-Host "✓ API key configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Remember to add your API key to .env before running the app" -ForegroundColor Yellow
        Write-Host "   Edit .env and replace 'your_anthropic_api_key_here' with your actual key" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

Write-Host ""

# Create uploads directory
if (-Not (Test-Path "public\uploads")) {
    New-Item -ItemType Directory -Path "public\uploads" -Force | Out-Null
    Write-Host "✓ Upload directory created" -ForegroundColor Green
} else {
    Write-Host "✓ Upload directory already exists" -ForegroundColor Green
}

Write-Host ""

# Setup complete
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure your Anthropic API key is in .env" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Open: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Happy building with WebForge AI! 🚀" -ForegroundColor Green
