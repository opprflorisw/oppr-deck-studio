# Renders a LinkedIn carousel's index.html to a 4:5 PDF with headless Chrome/Edge.
# The page size (1080x1350) comes from @page in templates/linkedin.css.
# Usage:  .\tools\build-carousel.ps1 -Carousel linkedin\2026-07-22_operators-are-the-sensor
param(
    [Parameter(Mandatory = $true)][string]$Carousel,
    [string]$Out
)

$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $root $Carousel
$html = Join-Path $dir "index.html"
if (-not (Test-Path $html)) { throw "Not found: $html" }

# Name always carries 'oppr' (LinkedIn output follows the same rule as decks).
if (-not $Out) {
    $leaf = Split-Path $dir -Leaf
    if ($leaf -match '^(\d{4}-\d{2}-\d{2})[_-](.+)$') {
        $name = "$($Matches[1])_oppr_$($Matches[2]).pdf"
    } else {
        $name = "oppr_$leaf.pdf"
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
& $browser --headless=new --disable-gpu --no-pdf-header-footer `
    --virtual-time-budget=10000 --print-to-pdf="$Out" $uri | Out-Null

if (Test-Path $Out) { Write-Output "Carousel PDF written: $Out" } else { throw "PDF was not produced." }
