# Renders a single social image's index.html to PNG with headless Chrome/Edge.
# The page is one .lpage inside .carousel--single, so the screenshot is the card
# exactly: pass the canvas size the HTML is built for (default 1080x1080).
# Usage:  .\tools\build-social-image.ps1 -Image social\linkedin\2026-07-23_hiring-senior-developer
param(
    [Parameter(Mandatory = $true)][string]$Image,
    [string]$Out,
    [int]$Width = 1080,
    [int]$Height = 1080
)

$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $root $Image
$html = Join-Path $dir "index.html"
if (-not (Test-Path $html)) { throw "Not found: $html" }

# Name always carries 'oppr' (social output follows the same rule as decks).
if (-not $Out) {
    $leaf = Split-Path $dir -Leaf
    if ($leaf -match '^(\d{4}-\d{2}-\d{2})[_-](.+)$') {
        $name = "$($Matches[1])_oppr_$($Matches[2]).png"
    } else {
        $name = "oppr_$leaf.png"
    }
    $Out = Join-Path $dir $name
}

$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "No Chrome or Edge found." }

$uri = ([uri]$html).AbsoluteUri
& $browser --headless=new --disable-gpu --hide-scrollbars `
    --force-device-scale-factor=1 --window-size="$Width,$Height" `
    --virtual-time-budget=10000 --screenshot="$Out" $uri | Out-Null

if (-not (Test-Path $Out)) { throw "PNG was not produced." }

# Report the real pixel size, so a crop that drifted is caught here and not in the feed.
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Out)
$dims = "$($img.Width)x$($img.Height)"
$img.Dispose()
$kb = [math]::Round((Get-Item $Out).Length / 1KB)
Write-Output "Social image written: $Out  ($dims, $kb KB)"
if ($dims -ne "${Width}x${Height}") { Write-Warning "Expected ${Width}x${Height}." }
