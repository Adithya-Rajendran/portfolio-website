# Fetch the full-resolution NASA Black Marble (public domain, via Wikimedia Commons) and shrink it for rendering.
$ErrorActionPreference = 'Stop'
Set-Location "$HOME\lobby-bake\blender"
if (-not (Test-Path textures_dl\night_hi.jpg)) {
  if (-not (Test-Path textures_dl\night_full.jpg)) {
    curl.exe -fsSL -A "LobbyDemoBuild/1.0 (local build script)" -o textures_dl\night_full.jpg "https://commons.wikimedia.org/wiki/Special:FilePath/BlackMarble20161km.jpg"
  }
  & "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe" -b --python night_hi.py 2>&1 | Select-String "SRC|NIGHT_HI|Error"
  Remove-Item textures_dl\night_full.jpg
}
Get-ChildItem textures_dl | Select-Object Name, Length
