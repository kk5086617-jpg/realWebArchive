$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (!(Test-Path -LiteralPath '.env')) {
    $passwordBytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
    $password = [Convert]::ToHexString($passwordBytes).ToLowerInvariant()
    Set-Content -LiteralPath '.env' -Value "POSTGRES_PASSWORD=$password" -Encoding utf8
    Write-Host 'Created deploy/.env with a random database password.'
}

$mkcert = Get-Command mkcert -ErrorAction SilentlyContinue
if (!$mkcert) {
    throw 'Install mkcert: winget install --id FiloSottile.mkcert -e, then reopen PowerShell.'
}
& $mkcert.Source -install
if ($LASTEXITCODE -ne 0) { throw 'mkcert -install failed.' }
New-Item -ItemType Directory -Force certs | Out-Null
& $mkcert.Source -cert-file certs/webarchive.localhost.pem -key-file certs/webarchive.localhost-key.pem webarchive.localhost localhost 127.0.0.1
if ($LASTEXITCODE -ne 0) { throw 'Certificate generation failed.' }
Write-Host 'Ready. Run: docker compose up --build -d'
