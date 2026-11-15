# Starts the whole stack locally and publishes it on a free Cloudflare quick tunnel.
#
#   D:\New folder\textile-cad>  powershell -ExecutionPolicy Bypass -File deploy\free\start-public.ps1
#
# What it does
#   1. builds the SPA (frontend\dist) when sources are newer,
#   2. builds + starts the Go API on 127.0.0.1:8080 (production mode),
#   3. serves the SPA with `vite preview` on 127.0.0.1:5173 (proxying /api -> 8080),
#   4. opens a cloudflared quick tunnel to 5173 and prints the public URL,
#   5. keeps everything alive: if the tunnel restarts, the API is restarted with
#      the new public origin so cookies/CORS keep working.
#
# The public URL is written to public-url.txt in the repository root.

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stateDir = Join-Path $env:LOCALAPPDATA 'textile-cad'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$urlFile = Join-Path $repo 'public-url.txt'
$logDir = Join-Path $stateDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Log([string]$message) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $message
    Write-Host $line
    Add-Content -Path (Join-Path $stateDir 'supervisor.log') -Value $line
}

# ---------------------------------------------------------------- secrets (.env)
$envFile = Join-Path $repo '.env'
if (-not (Test-Path $envFile)) { throw "missing .env at $envFile" }
$vars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([A-Za-z0-9_]+)=(.*)$') { $vars[$matches[1]] = $matches[2].Trim('"') }
}
$databaseUrl = if ($vars['SUPABASE_DATABASE_URL']) { $vars['SUPABASE_DATABASE_URL'] } else { $vars['DATABASE_URL'] }
if (-not $databaseUrl) { throw 'DATABASE_URL / SUPABASE_DATABASE_URL missing in .env' }
$jwtSecret = $vars['JWT_SECRET']
if (-not $jwtSecret -or $jwtSecret.Length -lt 32) { throw 'JWT_SECRET (32+ chars) missing in .env' }

# ------------------------------------------------------------------- cloudflared
$cloudflared = Join-Path $stateDir 'cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
    Log 'downloading cloudflared'
    Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
        -OutFile $cloudflared -UseBasicParsing -TimeoutSec 300
}

# ------------------------------------------------------------------- frontend build
$frontend = Join-Path $repo 'frontend'
$distIndex = Join-Path $frontend 'dist\index.html'
$newestSource = Get-ChildItem (Join-Path $frontend 'src') -Recurse -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not (Test-Path $distIndex) -or ($newestSource -and $newestSource.LastWriteTime -gt (Get-Item $distIndex).LastWriteTime)) {
    Log 'building frontend'
    Push-Location $frontend
    try {
        & npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
    } finally { Pop-Location }
}

# ------------------------------------------------------------------- api binary
$apiExe = Join-Path $stateDir 'api.exe'
$backend = Join-Path $repo 'backend'
$newestGo = Get-ChildItem $backend -Recurse -File -Include *.go |
    Where-Object { $_.FullName -notmatch '\\bin\\' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not (Test-Path $apiExe) -or ($newestGo -and $newestGo.LastWriteTime -gt (Get-Item $apiExe).LastWriteTime)) {
    Log 'building api'
    Push-Location $backend
    try {
        & go build -o $apiExe ./cmd/api 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'go build failed' }
    } finally { Pop-Location }
}

function Stop-Stale([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $conn.OwningProcess | Select-Object -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
}

function Start-Tunnel {
    $out = Join-Path $logDir 'cloudflared.out.log'
    $err = Join-Path $logDir 'cloudflared.err.log'
    Remove-Item $out, $err -ErrorAction SilentlyContinue
    $proc = Start-Process -FilePath $cloudflared `
        -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:5173', '--no-autoupdate' `
        -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $text = (Get-Content $err -Raw -ErrorAction SilentlyContinue) + (Get-Content $out -Raw -ErrorAction SilentlyContinue)
        if ($text -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            Log "public url $($matches[0])"
            return @{ Proc = $proc; Url = $matches[0] }
        }
        if ($proc.HasExited) { throw 'cloudflared exited while starting' }
    }
    throw 'cloudflared did not print a public url in time'
}

function Start-Api([string]$publicUrl) {
    Stop-Stale 8080
    $env:APP_ENV = 'production'
    $env:COOKIE_SECURE = 'true'
    $env:CORS_ORIGINS = $publicUrl
    $env:PUBLIC_WEB_URL = $publicUrl
    $env:SERVER_PORT = '8080'
    $env:PORT = '8080'
    $env:AUTO_MIGRATE = 'false'
    $env:LOGIN_RATE_PER_MIN = '8'
    $env:DATABASE_URL = $databaseUrl
    $env:JWT_SECRET = $jwtSecret
    $env:SEED_ADMIN_EMAIL = $vars['SEED_ADMIN_EMAIL']
    $env:SEED_ADMIN_PASSWORD = $vars['SEED_ADMIN_PASSWORD']
    $out = Join-Path $logDir 'api.log'
    $err = Join-Path $logDir 'api.err.log'
    Log 'starting api on 8080'
    Start-Process -FilePath $apiExe -WorkingDirectory $backend -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
}

function Start-Web {
    Stop-Stale 5173
    $out = Join-Path $logDir 'web.log'
    $err = Join-Path $logDir 'web.err.log'
    Log 'starting vite preview on 5173'
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npx vite preview --port 5173 --strictPort --host 127.0.0.1' `
        -WorkingDirectory $frontend -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
}

function Test-Port([int]$port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# ------------------------------------------------------------------- boot
$tunnel = Start-Tunnel
Set-Content -Path $urlFile -Value $tunnel.Url -NoNewline
Start-Api $tunnel.Url
Start-Web

for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    if ((Test-Port 8080) -and (Test-Port 5173)) { break }
}
Log 'stack is up'

# ------------------------------------------------------------------- supervise
while ($true) {
    Start-Sleep -Seconds 20
    try {
        if (-not (Test-Port 5173)) { Start-Web }
        if (-not (Test-Port 8080)) { Start-Api $tunnel.Url }
        if ($tunnel.Proc.HasExited) {
            Log 'tunnel died, restarting'
            $tunnel = Start-Tunnel
            Set-Content -Path $urlFile -Value $tunnel.Url -NoNewline
            Start-Api $tunnel.Url
        }
    } catch {
        Log "supervisor error: $($_.Exception.Message)"
    }
}
