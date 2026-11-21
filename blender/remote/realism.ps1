# Build and review first; bake the same .blend afterwards. Exit nonzero on Python errors.
param([ValidateSet('review','bake')]$Phase,[ValidateSet('lobby','about','projects','experience','writing')]$Room)
$ErrorActionPreference = 'Stop'
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME/lobby-bake/blender"
$b = "$HOME/lobby-bake/blender-5.0.1-windows-x64/blender.exe"
function Run-Blender { & $b -b @args; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
if ($Phase -eq 'review') {
    $script = if ($Room -eq 'lobby') { 'build_scene.py' } else { "room_$Room.py" }
    Run-Blender --python-exit-code 2 -P $script
    Run-Blender "$Room.blend" --python-exit-code 2 -P preview.py '--' "$HOME/lobby-bake/review_$Room.png" 24 1280
} else {
    if ($Room -in 'lobby','about','writing') { Run-Blender "$Room.blend" --python-exit-code 2 -P backdrop.py '--' 4096 }
    Run-Blender "$Room.blend" --python-exit-code 2 -P bake.py '--' 1.0 192
}
