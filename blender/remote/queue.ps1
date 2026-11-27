# Room build, path trace and export queue, one room at a time, on the bake machine
$rooms = if ($args.Count) { $args } else { 'about', 'lobby' }
$runner = Join-Path $PSScriptRoot 'realism.ps1'
foreach ($room in $rooms) {
    & $runner review $room; if ($LASTEXITCODE) { exit $LASTEXITCODE }
    & $runner bake $room; if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
