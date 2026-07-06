param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "beatsluv_backend"
$FrontendDir = Join-Path $ProjectRoot "beatsluv_frontend"
$BackendVenvActivate = Join-Path $BackendDir ".venv\Scripts\Activate.ps1"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"

if (-not (Test-Path $BackendDir)) {
    throw "Backend folder not found: $BackendDir"
}

if (-not (Test-Path $FrontendDir)) {
    throw "Frontend folder not found: $FrontendDir"
}

if (-not (Test-Path $BackendVenvActivate)) {
    Write-Host "Backend virtual environment not found. Creating .venv..."
    Push-Location $BackendDir
    try {
        python -m venv .venv
        & $BackendVenvActivate
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path $FrontendNodeModules)) {
    Write-Host "Frontend dependencies not found. Installing npm packages..."
    Push-Location $FrontendDir
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

$BackendCommand = @"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass;
cd '$BackendDir';
.\.venv\Scripts\Activate.ps1;
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
"@

$FrontendCommand = @"
cd '$FrontendDir';
npm run dev
"@

Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendCommand
Start-Sleep -Seconds 2
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $FrontendCommand

if (-not $NoBrowser) {
    Start-Sleep -Seconds 4
    Start-Process "http://127.0.0.1:5173"
}

Write-Host "Backend:  http://127.0.0.1:8001"
Write-Host "Frontend: http://127.0.0.1:5173"
