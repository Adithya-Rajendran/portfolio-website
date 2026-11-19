# Build + backdrop + bake for a list of rooms, one after another.   queue.ps1 about experience ...
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
foreach ($room in $args) {
  "ROOM $room"
  $script = if ($room -eq 'lobby') { 'build_scene.py' } else { "room_$room.py" }
  & $b -b --python $script 2>&1 | Select-String "OBJECTS|Traceback|Error|line "
  if (Select-String -Path $script -Pattern "portal=list" -Quiet) { & $b -b "$room.blend" --python backdrop.py -- 4096 2>&1 | Select-String "BACKDROP|Traceback|Error:" }
  & $b -b "$room.blend" --python bake.py -- 1.0 192 2>&1 | Select-String "BAKED|EXPORTED|Traceback|Error:|GROUPS"
  "DONE $room"
}
