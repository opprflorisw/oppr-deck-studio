# Renders every library slide to a thumbnail and regenerates library/catalog.html
# (the browsable slide catalog: thumbnails by role + canonical decks and variants).
# Thin shim over tools/build_slide_catalog.py.
# Usage:  .\tools\build-slide-catalog.ps1

$py = Join-Path $PSScriptRoot "build_slide_catalog.py"
python $py
exit $LASTEXITCODE
