$ErrorActionPreference = 'Stop'

function Add-PathIfExists {
  param([string]$Candidate)
  if ([string]::IsNullOrWhiteSpace($Candidate)) { return }
  if (-not (Test-Path $Candidate)) { return }
  $segments = $env:Path -split ';'
  if ($segments -notcontains $Candidate) {
    $env:Path = "$Candidate;$env:Path"
  }
}

function Load-DatabaseUrlFromEnvLocal {
  param([string]$EnvPath)
  if (-not (Test-Path $EnvPath)) { return $null }
  $line = Get-Content $EnvPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $line) { return $null }
  $value = ($line -split '=', 2)[1].Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Trim('"')
  }
  return $value
}

$env:PNPM_HOME = 'C:\Users\User\AppData\Local\pnpm'
Add-PathIfExists -Candidate $env:PNPM_HOME
Add-PathIfExists -Candidate 'e:\Users\User\AppData\Local\Programs\cursor\resources\app\resources\helpers'
Add-PathIfExists -Candidate 'C:\Program Files\nodejs'

if (-not $env:DATABASE_URL) {
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $envPath = Join-Path $projectRoot '.env.local'
  $dbUrl = Load-DatabaseUrlFromEnvLocal -EnvPath $envPath
  if ($dbUrl) { $env:DATABASE_URL = $dbUrl }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'node.exe not found in PATH. Add a valid Node.js path first.'
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw 'pnpm not found in PATH. Check PNPM_HOME.'
}

Write-Host "node: $(node -v)"
Write-Host "pnpm: $(pnpm -v)"
if ($env:DATABASE_URL) { Write-Host 'DATABASE_URL: set' }
if (-not $env:DATABASE_URL) { Write-Host 'DATABASE_URL: missing (db commands may fail)' }

Write-Host 'Environment prepared.'
Write-Host 'Now run: pnpm db:migrate'
