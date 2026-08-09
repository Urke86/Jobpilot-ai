# Upsert Google Edge secrets from gitignored .env.local without printing values.
# Usage: .\scripts\set-google-edge-secrets.ps1
# Requires in .env.local:
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
#   GOOGLE_REDIRECT_URI, GOOGLE_TOKEN_ENCRYPTION_KEY, JOBPILOT_APP_URL
#   SUPABASE_ACCESS_TOKEN

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) {
  Write-Error '.env.local not found'
}

$map = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$') {
    $map[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

$required = @(
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_TOKEN_ENCRYPTION_KEY',
  'JOBPILOT_APP_URL',
  'SUPABASE_ACCESS_TOKEN'
)

$missing = @()
foreach ($k in $required) {
  if (-not $map.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($map[$k])) {
    $missing += $k
  }
}
if ($missing.Count -gt 0) {
  Write-Host "MISSING_KEYS=$($missing -join ',')"
  exit 2
}

# Validate formats without printing values
$redir = $map['GOOGLE_REDIRECT_URI']
if ($redir -ne 'https://xzzoznhmezmaarcvavpr.supabase.co/functions/v1/google-oauth-callback') {
  Write-Error 'GOOGLE_REDIRECT_URI does not match the required callback URL.'
}

$key = $map['GOOGLE_TOKEN_ENCRYPTION_KEY']
$hexOk = $key -match '^[0-9a-fA-F]{64}$'
$rawOk = ([System.Text.Encoding]::UTF8.GetByteCount($key) -ge 32)
if (-not ($hexOk -or $rawOk)) {
  Write-Error 'GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex chars or at least 32 raw bytes.'
}

Write-Host 'Key presence check (names only):'
foreach ($k in $required) {
  Write-Host "  $k=SET len=$($map[$k].Length)"
}

$env:SUPABASE_ACCESS_TOKEN = $map['SUPABASE_ACCESS_TOKEN']

# Pass secrets via process env to avoid shell history echo of values in argv listing tools
$env:GOOGLE_CLIENT_ID = $map['GOOGLE_CLIENT_ID']
$env:GOOGLE_CLIENT_SECRET = $map['GOOGLE_CLIENT_SECRET']
$env:GOOGLE_REDIRECT_URI = $map['GOOGLE_REDIRECT_URI']
$env:GOOGLE_TOKEN_ENCRYPTION_KEY = $map['GOOGLE_TOKEN_ENCRYPTION_KEY']
$env:JOBPILOT_APP_URL = $map['JOBPILOT_APP_URL']
if ($map.ContainsKey('GOOGLE_OAUTH_STATE_SECRET') -and $map['GOOGLE_OAUTH_STATE_SECRET']) {
  $env:GOOGLE_OAUTH_STATE_SECRET = $map['GOOGLE_OAUTH_STATE_SECRET']
}

# Use cmd to expand env vars into supabase secrets set without Write-Host of values
$extra = ''
if ($env:GOOGLE_OAUTH_STATE_SECRET) {
  $extra = ' GOOGLE_OAUTH_STATE_SECRET=%GOOGLE_OAUTH_STATE_SECRET%'
}

$cmd = @"
npx supabase secrets set GOOGLE_CLIENT_ID=%GOOGLE_CLIENT_ID% GOOGLE_CLIENT_SECRET=%GOOGLE_CLIENT_SECRET% GOOGLE_REDIRECT_URI=%GOOGLE_REDIRECT_URI% GOOGLE_TOKEN_ENCRYPTION_KEY=%GOOGLE_TOKEN_ENCRYPTION_KEY% JOBPILOT_APP_URL=%JOBPILOT_APP_URL%$extra --project-ref xzzoznhmezmaarcvavpr
"@

cmd /c $cmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'SECRETS_SET_OK'
# List secret names only from remote
cmd /c "npx supabase secrets list --project-ref xzzoznhmezmaarcvavpr"
exit $LASTEXITCODE
