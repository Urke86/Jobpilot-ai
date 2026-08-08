# Load JobPilot-scoped Supabase access token from .env.local and run supabase CLI.
# Why: `supabase login` stores ONE global Windows credential. Logging into another
# Supabase account (e.g. 18Holes) overwrites it. JobPilot keeps its own token here.
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$SupabaseArgs
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found. Create it and add SUPABASE_ACCESS_TOKEN=sbp_..."
}

$token = $null
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$') {
    $token = $matches[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $token) {
  Write-Error "SUPABASE_ACCESS_TOKEN missing in .env.local. Run: npm run supabase:login"
}

$env:SUPABASE_ACCESS_TOKEN = $token
& supabase @SupabaseArgs
exit $LASTEXITCODE
