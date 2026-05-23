# Install Solana CLI on Windows
# Run from project root: .\scripts\install-solana.ps1

$ErrorActionPreference = "Stop"

$installDir = "$env:USERPROFILE\.local\share\solana\install"
$binDir = "$installDir\active_release\bin"
$releaseVersion = "stable"
$arch = "x86_64-pc-windows-msvc"
$baseUrl = "https://release.anza.xyz/$releaseVersion"

Write-Host "[solana] Downloading release manifest..."
$releaseUrl = "$baseUrl/solana-release-$arch.tar.bz2"
$tarPath = "$env:TEMP\solana-release.tar.bz2"

Invoke-WebRequest -Uri $releaseUrl -OutFile $tarPath
Write-Host "[solana] Downloaded to $tarPath"

# Extract using tar (available on Windows 10+)
$extractDir = "$env:TEMP\solana-release"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
New-Item -ItemType Directory -Path $extractDir | Out-Null

Write-Host "[solana] Extracting..."
tar -xjf $tarPath -C $extractDir

# Find the bin directory in the extracted archive
$extractedBin = Get-ChildItem $extractDir -Recurse -Filter "solana.exe" | Select-Object -First 1
if (-not $extractedBin) {
    Write-Error "[solana] Could not find solana.exe in extracted archive"
    exit 1
}
$extractedBinDir = $extractedBin.DirectoryName
Write-Host "[solana] Found binaries at $extractedBinDir"

# Copy to install location
New-Item -ItemType Directory -Path $binDir -Force | Out-Null
Copy-Item "$extractedBinDir\*" $binDir -Force
Write-Host "[solana] Installed to $binDir"

# Add to user PATH permanently
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*solana*") {
    [System.Environment]::SetEnvironmentVariable("PATH", "$currentPath;$binDir", "User")
    Write-Host "[solana] Added $binDir to user PATH"
} else {
    Write-Host "[solana] PATH already contains a solana entry"
}

# Add to current session
$env:PATH += ";$binDir"

# Verify
$ver = & "$binDir\solana.exe" --version
Write-Host "[solana] Installed: $ver"
Write-Host ""
Write-Host "Done. Open a new terminal and run: solana --version"
