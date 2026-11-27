# Render of one asset of a room alone in a studio on the bake machine
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
$room = $args[0]
if ($args.Length -lt 2) { throw 'Usage: asset.ps1 <room> <asset> [asset ...]' }
$script = if ($room -eq 'lobby') { 'build_scene.py' } else { "room_$room.py" }
try {
  foreach ($a in $args[1..($args.Length - 1)]) {
    $env:ASSET = $a
    & $b -b --python-exit-code 2 --python $script 2>&1 | Select-String "ASSET|Traceback|Error|line "
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} finally { Remove-Item Env:ASSET -ErrorAction SilentlyContinue }
