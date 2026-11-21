# Re-run only some bake passes.   passes.ps1 <passes: base,chand,layers> <scale> <spp>
$env:LOBBY_DEVICE = 'OPTIX'; $env:LOBBY_PASSES = $args[0]
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
# Only reuse the other passes if geometry, UVs and light setup have not changed.
& $b -b --python-exit-code 2 -P build_scene.py; if ($LASTEXITCODE) { exit $LASTEXITCODE }
& $b -b lobby.blend --python-exit-code 2 -P reflection_probe.py; if ($LASTEXITCODE) { exit $LASTEXITCODE }
& $b -b lobby.blend --python-exit-code 2 -P bake.py '--' $args[1] $args[2]
exit $LASTEXITCODE
