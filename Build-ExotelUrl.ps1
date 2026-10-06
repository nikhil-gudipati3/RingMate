# Build-ExotelUrl.ps1
# Builds the Exotel Voicebot Stream URL from your .env credentials + tunnel host,
# and copies it straight to your clipboard. No credentials stored anywhere else.
#
# Usage:  .\Build-ExotelUrl.ps1 <tunnel-host>
# Example: .\Build-ExotelUrl.ps1 cosmetic-cincinnati-summit-discussions.trycloudflare.com

param([string]$TunnelHost)

if (-not $TunnelHost) {
    Write-Host "Usage: .\Build-ExotelUrl.ps1 <tunnel-host>"
    Write-Host "Example: .\Build-ExotelUrl.ps1 cosmetic-cincinnati-summit-discussions.trycloudflare.com"
    exit 1
}
# Strip https:// if pasted with it
$TunnelHost = $TunnelHost -replace '^https?://', '' -replace '/.*$', ''

$envPath = "D:\ringmate\.env"
$key = $null; $token = $null
foreach ($line in Get-Content $envPath) {
    if ($line -match '^\s*EXOTEL_API_KEY\s*=\s*(.+?)\s*$') { $key = $Matches[1] }
    if ($line -match '^\s*EXOTEL_API_TOKEN\s*=\s*(.+?)\s*$') { $token = $Matches[1] }
}

if (-not $key -or -not $token) {
    Write-Host "ERROR: Could not find EXOTEL_API_KEY / EXOTEL_API_TOKEN in $envPath"
    exit 1
}
if ($token.Length -ne 48) {
    Write-Host "WARNING: token is $($token.Length) chars, expected 48. Check your .env before pasting."
}

$url = "wss://${key}:${token}@${TunnelHost}/voice/exotel/stream"
Set-Clipboard $url
Write-Host "Copied to clipboard. Paste it into the Exotel Stream URL field."
