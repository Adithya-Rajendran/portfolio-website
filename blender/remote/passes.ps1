# Re-run only some bake passes.   passes.ps1 <passes: base,chand,layers> <scale> <spp>
$env:LOBBY_DEVICE = 'OPTIX'; $env:LOBBY_PASSES = $args[0]
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
& $b -b --python build_scene.py 2>&1 | Select-String "OBJECTS|Traceback|Error:"
& $b -b lobby.blend --python bake.py -- $args[1] $args[2] 2>&1
