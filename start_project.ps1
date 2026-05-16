$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "beatsluv_backend"
$FrontendDir = Join-Path $ProjectRoot "beatsluv_frontend"
$BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$FrontendEnv = Join-Path $FrontendDir ".env.local"
$FrontendUrl = "http://127.0.0.1:5173"
$BackendUrl = "http://127.0.0.1:8001"

function Test-PortListening {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    return $null -ne $connection
}

if (-not (Test-Path $BackendPython)) {
    throw "Backend virtual environment not found at $BackendPython. Create it and run pip install -r requirements.txt first."
}

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    throw "Frontend dependencies are missing. Run npm install from $FrontendDir first."
}

Set-Content -Path $FrontendEnv -Value "VITE_API_URL=$BackendUrl" -Encoding utf8

if (-not (Test-PortListening -Port 8001)) {
    Start-Process `
        -FilePath $BackendPython `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8001" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden
    Write-Host "Started backend on $BackendUrl"
} else {
    Write-Host "Backend already running on $BackendUrl"
}

if (-not (Test-PortListening -Port 5173)) {
    Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173" `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden
    Write-Host "Started frontend on $FrontendUrl"
} else {
    Write-Host "Frontend already running on $FrontendUrl"
}

Start-Sleep -Seconds 3
Start-Process $FrontendUrl
Write-Host "Opened $FrontendUrl"
