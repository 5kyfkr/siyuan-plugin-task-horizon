param(
    [ValidateSet('release', 'full', 'calendar', 'checklist', 'kanban', 'settings', 'task', 'ai', 'whiteboard', 'mobile')]
    [string]$Suite = 'release'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$allTests = @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts') -Filter '*.test.js' -File | Sort-Object Name)
$releaseTests = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'scripts/release-tests.json') | ConvertFrom-Json
$releaseNames = @($releaseTests.core) + @($releaseTests.browser)
if (@($releaseNames | Select-Object -Unique).Count -ne $releaseNames.Count) { throw 'Duplicate release test entry' }
foreach ($name in $releaseNames) {
    if (-not ($allTests.Name -contains $name)) { throw "Release test not found: $name" }
}
if ($Suite -eq 'release') {
    $tests = @($allTests | Where-Object { $releaseNames -contains $_.Name })
} elseif ($Suite -eq 'full') {
    $tests = $allTests
} else {
    $modulePatterns = @{
        calendar = '^(calendar-|reminder-|schedule-|semantic-date-|recurring-)'
        checklist = '^(checklist-|parent-subtask-|task-progress-|layout-and-subtask-)'
        kanban = '^(kanban-|pinned-|parent-subtask-|task-field-|task-pinned-)'
        settings = '^(settings-|kernel-settings-|doc-group-order-|custom-field-|completed-task-visibility-by-group)'
        task = '^(task-|subtask-|completion-|completed-|repeat-|monthly-repeat-|project-|document-loader-|kernel-|meta-store-)'
        ai = '^(agent-|ai-|scheduled-events|schedule-notification-|kernel-settings-|skill-)'
        whiteboard = '^(whiteboard-|global-whiteboard-)'
        mobile = '^(mobile-|tablet-|table-touch-|device-|quickbar-mobile-|quickbar-text-|quick-add-keyboard-|calendar-mobile-|calendar-schedule-editor-device-|task-detail-sheet-|task-detail-ios-)'
    }
    $tests = @($allTests | Where-Object { $_.Name -match $modulePatterns[$Suite] })
}
if (-not $tests.Count) { throw 'No contract tests found' }
$watch = [System.Diagnostics.Stopwatch]::StartNew()
Write-Host ("Verifying {0}: {1} test files" -f $Suite, $tests.Count)

& node (Join-Path $root 'scripts/check-runtime-syntax.js')
if ($LASTEXITCODE -ne 0) { throw 'Runtime syntax or manifest check failed' }

& node (Join-Path $root 'scripts/check-task-writer-boundary.js') --strict
if ($LASTEXITCODE -ne 0) { throw 'Task writer boundary check failed' }

if (($tests | Where-Object { $_.Name -match 'browser.*\.test\.js$' }) -and [string]::IsNullOrWhiteSpace($env:PLAYWRIGHT_MODULE)) {
    $playwrightVersion = '1.63.0'
    $testDependencyDir = Join-Path ([System.IO.Path]::GetTempPath()) "task-horizon-release-tests-$playwrightVersion"
    $playwrightModule = Join-Path $testDependencyDir 'node_modules/playwright'
    $playwrightCached = Test-Path -LiteralPath (Join-Path $playwrightModule 'package.json') -PathType Leaf
    if (-not $playwrightCached) {
        & npm install --prefix $testDependencyDir --no-save --no-package-lock --ignore-scripts "playwright@$playwrightVersion"
        if ($LASTEXITCODE -ne 0) { throw 'Playwright test dependency installation failed' }
    }
    $browserInstallArgs = @('install', 'chromium')
    $browsersCached = Test-Path -LiteralPath (Join-Path $HOME '.cache/ms-playwright')
    if ($IsLinux -and -not ($playwrightCached -and $browsersCached)) {
        # --with-deps runs apt, and system packages live on the runner instead of
        # the restored cache, so it is the slowest and least predictable part of a
        # release (the Ubuntu mirror can drop to ~80 kB/s). A restored Playwright
        # module plus browser cache means the browsers are already usable, so a
        # plain install is enough; only a cold cache needs the apt dependencies.
        $browserInstallArgs = @('install', '--with-deps', 'chromium')
    }
    & node (Join-Path $playwrightModule 'cli.js') @browserInstallArgs
    if ($LASTEXITCODE -ne 0) { throw 'Chromium test browser installation failed' }
    $env:PLAYWRIGHT_MODULE = $playwrightModule
}

$originalSmoke = $env:TM_TEST_SMOKE
try {
    if ($Suite -eq 'release') { $env:TM_TEST_SMOKE = '1' }
    else { $env:TM_TEST_SMOKE = '0' }
    foreach ($test in $tests) {
        & node $test.FullName
        if ($LASTEXITCODE -ne 0) { throw "Test failed: $($test.Name)" }
    }
} finally {
    $env:TM_TEST_SMOKE = $originalSmoke
}

$watch.Stop()
Write-Host ("Verification passed ({0}): {1} test files in {2:N1}s" -f $Suite, $tests.Count, $watch.Elapsed.TotalSeconds)
