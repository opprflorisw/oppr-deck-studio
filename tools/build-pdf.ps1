# Renders a deck's index.html to PDF with headless Chrome/Edge.
# Usage:  .\tools\build-pdf.ps1 -Deck decks\2026-07-21_mutares-portfolio [-Out custom.pdf]
param(
    [Parameter(Mandatory = $true)][string]$Deck,
    [string]$Out
)

$root = Split-Path $PSScriptRoot -Parent
$deckDir = Join-Path $root $Deck
$html = Join-Path $deckDir "index.html"
if (-not (Test-Path $html)) { throw "Not found: $html" }

# Derive the PDF name from deck.yaml (always carries 'oppr'; client decks carry
# the client slug) rather than trusting the folder leaf. verify-deck.py enforces
# the same rule, so an -Out that breaks it will FAIL verification.
if (-not $Out) {
    $pdfName = & python (Join-Path $PSScriptRoot "deck_pdf_name.py") $Deck
    if ($LASTEXITCODE -ne 0 -or -not $pdfName) { throw "Could not derive PDF name for $Deck" }
    $Out = Join-Path $deckDir $pdfName.Trim()
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

if (Test-Path $Out) { Write-Output "PDF written: $Out" } else { throw "PDF was not produced." }
