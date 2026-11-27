# Look-dev render of the portal view on the bake machine
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
$i = 0
foreach ($e in $args) {
  $env:EARTH = $e
  & $b -b --python build_scene.py 2>&1 | Select-String "Traceback|Error:|line " | Select-Object -First 4
  & $b -b lobby.blend --python earth_preview.py -- "$HOME\lobby-bake\blender\out\er_$i.png" 24 900 2>&1 | Select-String "Traceback|Error:" | Select-Object -First 3
  $i++
}
Remove-Item Env:EARTH
