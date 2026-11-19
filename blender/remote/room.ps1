# Per-room runner.   room.ps1 <room> build | preview <out.png> <spp> <width> [cam] | bake <scale> <spp>
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
$room = $args[0]; $cmd = $args[1]; $rest = $args[2..($args.Length)]
if ($cmd -eq 'build') { & $b -b --python "room_$room.py" 2>&1 | Select-String "OBJECTS|Traceback|Error|line " }
elseif ($cmd -eq 'preview') { & $b -b "$room.blend" --python preview.py -- @rest 2>&1 | Select-String "Traceback|Error:|Saved" }
elseif ($cmd -eq 'bake') { & $b -b "$room.blend" --python bake.py -- @rest 2>&1 }
