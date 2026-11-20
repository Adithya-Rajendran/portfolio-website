# One asset of a room alone in a studio.   asset.ps1 <room> <asset> [<asset> ...]   -> blender\asset_<name>_0.png, _1.png
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
$room = $args[0]
foreach ($a in $args[1..($args.Length)]) { $env:ASSET = $a; & $b -b --python "room_$room.py" 2>&1 | Select-String "ASSET|Traceback|Error|line " }
$env:ASSET = ''
