# queue.ps1 [about lobby writing ...] — build, path-trace and export, one room at a time.
# Keep the canonical probe/lighting runner shared with isolated staging jobs.
$rooms = if ($args.Count) { $args } else { 'about', 'lobby' }
$runner = Join-Path $PSScriptRoot 'realism.ps1'
foreach ($room in $rooms) {
    & $runner review $room; if ($LASTEXITCODE) { exit $LASTEXITCODE }
    & $runner bake $room; if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
