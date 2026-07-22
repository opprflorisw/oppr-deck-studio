# Regenerates the design-system specimens under library/design-system/ (rendered
# from the real templates/deck.css + showcase.css) and their index.
# Thin shim over tools/build_design_system.py. Sync to claude.ai/design via /design-sync.
# Usage:  .\tools\build-design-system.ps1

$py = Join-Path $PSScriptRoot "build_design_system.py"
python $py
exit $LASTEXITCODE
