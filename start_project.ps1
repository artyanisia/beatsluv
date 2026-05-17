param(
    [string]$AceStepDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "_ACE-Step-1.5"),
    [int]$AceStepPort = 7860,
    [int]$BackendPort = 8001,
    [int]$FrontendPort = 5173,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "beatsluv_backend"
$FrontendDir = Join-Path $ProjectRoot "beatsluv_frontend"
$BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$FrontendEnv = Join-Path $FrontendDir ".env.local"
$AceStepUrl = "http://127.0.0.1:$AceStepPort"
$BackendUrl = "http://127.0.0.1:$BackendPort"
$FrontendUrl = "http://127.0.0.1:$FrontendPort"

function Test-PortListening {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    return $null -ne $connection
}

function Test-ProcessCommandLine {
    param([string]$Pattern)

    $process = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern } |
        Select-Object -First 1

    return $null -ne $process
}

function Test-HttpReady {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

if (-not (Test-Path $AceStepDir)) {
    throw "ACE-Step directory not found at $AceStepDir."
}

if (-not (Test-Path (Join-Path $AceStepDir "run_acestep_local.ps1"))) {
    throw "ACE-Step start script not found at $AceStepDir\run_acestep_local.ps1."
}

if (-not (Test-Path $BackendPython)) {
    throw "Backend virtual environment not found at $BackendPython. Create it and run pip install -r requirements.txt first."
}

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    throw "Frontend dependencies are missing. Run npm install from $FrontendDir first."
}

Set-Content -Path $FrontendEnv -Value "VITE_API_URL=$BackendUrl" -Encoding utf8

$aceStepPattern = "acestep.*--port\s+$AceStepPort|run_acestep_local\.ps1"
$aceOutLog = Join-Path $AceStepDir "beatsluv_acestep.out.log"
$aceErrLog = Join-Path $AceStepDir "beatsluv_acestep.err.log"

if (Test-PortListening -Port $AceStepPort) {
    Write-Host "ACE-Step already running on $AceStepUrl"
} elseif (Test-ProcessCommandLine -Pattern $aceStepPattern) {
    Write-Host "ACE-Step is already starting. It may take a few minutes before $AceStepUrl/health responds."
} else {
    Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList "-ExecutionPolicy", "Bypass", "-File", ".\run_acestep_local.ps1", "-Port", "$AceStepPort" `
        -WorkingDirectory $AceStepDir `
        -RedirectStandardOutput $aceOutLog `
        -RedirectStandardError $aceErrLog `
        -WindowStyle Hidden
    Write-Host "Started ACE-Step on $AceStepUrl"
    Write-Host "ACE-Step logs: $aceOutLog and $aceErrLog"
}

if (-not (Test-PortListening -Port $BackendPort)) {
    Start-Process `
        -FilePath $BackendPython `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "$BackendPort" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden
    Write-Host "Started backend on $BackendUrl"
} else {
    Write-Host "Backend already running on $BackendUrl"
}

if (-not (Test-PortListening -Port $FrontendPort)) {
    Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "$FrontendPort" `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden
    Write-Host "Started frontend on $FrontendUrl"
} else {
    Write-Host "Frontend already running on $FrontendUrl"
}

Start-Sleep -Seconds 3

if (Test-HttpReady -Url "$AceStepUrl/health") {
    Write-Host "ACE-Step is ready."
} else {
    Write-Host "ACE-Step is not ready yet. Wait until $AceStepUrl/health responds before generating music."
}

if (-not $NoBrowser) {
    Start-Process $FrontendUrl
    Write-Host "Opened $FrontendUrl"
}

Write-Host ""
Write-Host "Frontend: $FrontendUrl"
Write-Host "Backend:  $BackendUrl"
Write-Host "ACE-Step: $AceStepUrl"
