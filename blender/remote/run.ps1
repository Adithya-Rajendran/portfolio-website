# usage: run.ps1 <script.py> [args...]   (runs headless Blender in lobby-bake\blender with OptiX)
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
$script = $args[0]; $rest = $args[1..($args.Length)]
if ($script -eq 'build_scene.py') { & $b -b --python $script 2>&1 }
else { & $b -b lobby.blend --python $script -- @rest 2>&1 }
