param(
  [int]$Port = 18777
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$exe = Join-Path $backend "target\debug\backend.exe"
$outLog = Join-Path $root "backend-real.out.log"

Set-Location $backend

$env:HOST = "127.0.0.1"
$env:PORT = "$Port"

try {
  Clear-Content -Encoding UTF8 -Path $outLog -ErrorAction Stop
} catch {
  Set-Content -Encoding UTF8 -Path $outLog -Value ""
}

& $exe *>> $outLog
