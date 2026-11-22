# Live-reflection masters on the bake machine: build the room, render its probes, bake.
#   live.ps1 build|probe|bake|draft <room> [Root]
# 'bake' = 1.0 scale, 192 spp; 'draft' = 0.25, 24 spp. The exterior backdrop is unchanged and reused from git.
param([ValidateSet('build','probe','bake','draft')]$Phase,[ValidateSet('lobby','about','projects','experience','writing')]$Room,
      [string]$Root = "$HOME/lobby-bake")
$ErrorActionPreference = 'Stop'
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$Root/blender"
$b = "$HOME/lobby-bake/blender-5.0.1-windows-x64/blender.exe"
function Run-Blender { & $b -b @args; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
switch ($Phase) {
    'build' { Run-Blender --python-exit-code 2 -P $(if ($Room -eq 'lobby') { 'build_scene.py' } else { "room_$Room.py" }) }
    'probe' { Run-Blender "$Room.blend" --python-exit-code 2 -P reflection_probe.py }
    'draft' { Run-Blender "$Room.blend" --python-exit-code 2 -P bake.py '--' 0.25 24 }
    'bake'  { Run-Blender "$Room.blend" --python-exit-code 2 -P bake.py '--' 1.0 192 }
}
