# Regenerates brand/img/index.html — a contact-sheet gallery of every image
# asset, grouped by folder. Run after adding or removing images.
# Usage:  .\tools\build-asset-index.ps1

$root = Split-Path $PSScriptRoot -Parent
$imgRoot = Join-Path $root "brand\img"
$out = Join-Path $imgRoot "index.html"

$files = Get-ChildItem $imgRoot -Recurse -File -Include *.png, *.jpg, *.jpeg, *.webp, *.svg, *.gif, *.avif |
    Sort-Object FullName

$groups = $files | Group-Object { Split-Path $_.FullName -Parent } | Sort-Object Name

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine(@'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Oppr deck assets</title>
<style>
  body { font-family: Arial, sans-serif; background: #f2f2ed; color: #15201e; margin: 0; padding: 32px 40px; }
  h1 { letter-spacing: -0.03em; } h1 b { color: #a65032; }
  h2 { font-size: 15px; font-family: Consolas, monospace; letter-spacing: 0.04em; margin: 36px 0 10px; border-bottom: 1px solid #c8ceca; padding-bottom: 6px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { margin: 0; width: 190px; background: #fcfbf7; border: 1px solid #c8ceca; border-radius: 8px; padding: 8px; }
  figure img { width: 100%; height: 120px; object-fit: contain; display: block; background: repeating-conic-gradient(#e8e8e2 0% 25%, #fff 0% 50%) 0 0/16px 16px; border-radius: 4px; }
  figcaption { font-family: Consolas, monospace; font-size: 9.5px; color: #5f6965; margin-top: 6px; word-break: break-all; }
</style>
</head>
<body>
<h1>oppr<b>.</b> deck assets</h1>
'@)

$totalCount = ($files | Measure-Object).Count
[void]$sb.AppendLine("<p style='font-family:Consolas,monospace;font-size:12px;color:#5f6965;'>$totalCount images &middot; regenerate with tools\build-asset-index.ps1</p>")

foreach ($g in $groups) {
    $rel = $g.Name.Substring($imgRoot.Length).TrimStart('\')
    if (-not $rel) { $rel = "(root)" }
    [void]$sb.AppendLine("<h2>$rel</h2><div class='grid'>")
    foreach ($f in $g.Group) {
        $relFile = $f.FullName.Substring($imgRoot.Length).TrimStart('\') -replace '\\', '/'
        $src = [uri]::EscapeUriString($relFile)
        [void]$sb.AppendLine("<figure><img loading='lazy' src='$src'><figcaption>$relFile</figcaption></figure>")
    }
    [void]$sb.AppendLine("</div>")
}

[void]$sb.AppendLine("</body></html>")
Set-Content -Path $out -Value $sb.ToString() -Encoding utf8
Write-Output "Gallery written: $out ($totalCount images)"
