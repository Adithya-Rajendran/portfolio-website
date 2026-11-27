# Runner for one room on the bake machine
$env:LOBBY_DEVICE = 'OPTIX'
Set-Location "$HOME\lobby-bake\blender"
$b = "$HOME\lobby-bake\blender-5.0.1-windows-x64\blender.exe"
$room = $args[0]; $cmd = $args[1]; $rest = @($args | Select-Object -Skip 2)
$script = if ($room -eq 'lobby') { 'build_scene.py' } else { "room_$room.py" }
if ($cmd -eq 'build') { & $b -b --python-exit-code 2 -P $script }
elseif ($cmd -eq 'preview') { & $b -b "$room.blend" --python-exit-code 2 -P preview.py '--' @rest }
elseif ($cmd -eq 'bake') {
    & $b -b "$room.blend" --python-exit-code 2 -P reflection_probe.py; if ($LASTEXITCODE) { exit $LASTEXITCODE }
    & $b -b "$room.blend" --python-exit-code 2 -P bake.py '--' @rest
}
exit $LASTEXITCODE
