param(
  [int]$Port = 3000,
  [switch]$StopExisting
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:NEXT_TELEMETRY_DISABLED = "1"
$env:PORT = "$Port"

$outLog = Join-Path $root "frontend-dev.out.log"
$errLog = Join-Path $root "frontend-dev.err.log"

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($listeners) {
  if (-not $StopExisting) {
    $ids = ($listeners -join ", ")
    Write-Host "Port $Port is already in use by PID(s): $ids"
    Write-Host "Run with -StopExisting to stop them before starting Next dev."
    exit 1
  }

  foreach ($processId in $listeners) {
    Write-Host "Stopping existing process on port ${Port}: PID $processId"
    Stop-Process -Id $processId -Force
  }

  $deadline = (Get-Date).AddSeconds(8)
  do {
    Start-Sleep -Milliseconds 250
    $stillListening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  } while ($stillListening -and (Get-Date) -lt $deadline)
}

try {
  Clear-Content -Encoding UTF8 -Path $outLog -ErrorAction Stop
} catch {
  Set-Content -Encoding UTF8 -Path $outLog -Value ""
}
try {
  Clear-Content -Encoding UTF8 -Path $errLog -ErrorAction Stop
} catch {
  Set-Content -Encoding UTF8 -Path $errLog -Value ""
}

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) {
  $npm = (Get-Command npm -ErrorAction Stop).Source
}

$process = Start-Process `
  -FilePath $npm `
  -ArgumentList "run", "dev", "--", "-p", "$Port" `
  -WorkingDirectory $root `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden `
  -PassThru

Write-Host "Frontend dev server starting on http://127.0.0.1:$Port"
Write-Host "PID: $($process.Id)"
Write-Host "Logs: $outLog / $errLog"
