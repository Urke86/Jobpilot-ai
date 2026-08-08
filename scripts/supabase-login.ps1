# One-time: save JobPilot access token into .env.local (gitignored).
# After this, use `npm run supabase -- <cmd>` — no more global re-login for JobPilot.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

Write-Host ""
Write-Host "=== JobPilot AI — one-time Supabase token ===" -ForegroundColor Cyan
Write-Host "1) Open https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
Write-Host "2) Login to the account that owns JobPilot AI" -ForegroundColor Yellow
Write-Host "3) Generate token, paste below (stored only in .env.local)" -ForegroundColor Yellow
Write-Host ""

Start-Process "https://supabase.com/dashboard/account/tokens"
$secure = Read-Host "Paste JobPilot access token" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$token = $token.Trim()
if (-not $token.StartsWith('sbp_')) {
  Write-Error "Token should start with sbp_. Got prefix: $($token.Substring(0, [Math]::Min(6, $token.Length)))"
}

$envFile = Join-Path $root '.env.local'
$lines = @()
if (Test-Path $envFile) {
  $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*SUPABASE_ACCESS_TOKEN\s*=' }
}
$lines += "SUPABASE_ACCESS_TOKEN=$token"
Set-Content -Path $envFile -Value $lines -Encoding utf8

Write-Host "Saved SUPABASE_ACCESS_TOKEN to .env.local" -ForegroundColor Green

$env:SUPABASE_ACCESS_TOKEN = $token
Write-Host ""
Write-Host "Verifying projects..." -ForegroundColor Cyan
supabase projects list
Write-Host ""
Write-Host "Done. From now on use: npm run supabase -- <command>" -ForegroundColor Green
Write-Host "Example: npm run supabase -- functions deploy analyze-job" -ForegroundColor Green
