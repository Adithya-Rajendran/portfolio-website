# Room build and review render on the bake machine
param([ValidateSet('review','bake','draft')]$Phase,[ValidateSet('lobby','about','projects','experience','writing')]$Room,
      [string]$Root = "$HOME/lobby-bake")
$ErrorActionPreference = 'Stop'
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$Root/blender"
$b = "$HOME/lobby-bake/blender-5.0.1-windows-x64/blender.exe"
function Run-Blender { & $b -b @args; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
if ($Phase -eq 'review') {
    $script = if ($Room -eq 'lobby') { 'build_scene.py' } else { "room_$Room.py" }
    Run-Blender --python-exit-code 2 -P $script
    Run-Blender "$Room.blend" --python-exit-code 2 -P preview.py '--' "$Root/review_$Room.png" 24 1280
} else {
    Run-Blender "$Room.blend" --python-exit-code 2 -P reflection_probe.py
    if ($Room -in 'lobby','about','writing') { Run-Blender "$Room.blend" --python-exit-code 2 -P backdrop.py '--' 4096 }
    if ($Phase -eq 'draft') { Run-Blender "$Room.blend" --python-exit-code 2 -P bake.py '--' 0.25 24 }
    else { Run-Blender "$Room.blend" --python-exit-code 2 -P bake.py '--' 1.0 192 }
}
