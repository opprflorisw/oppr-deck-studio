# Regenerates brand/img/index.html — a contact sheet of every image asset with
# its description, entitlement and suggested-use from brand/img/library.json,
# and warns on drift (file without manifest entry, or manifest entry without file).
# Thin shim over tools/build_asset_index.py (robust UTF-8 string handling).
# Usage:  .\tools\build-asset-index.ps1

$py = Join-Path $PSScriptRoot "build_asset_index.py"
python $py
exit $LASTEXITCODE
