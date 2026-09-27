$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$tests = Get-ChildItem -LiteralPath (Join-Path $root 'scripts') -Filter '*.test.js' -File | Sort-Object Name
if (-not $tests.Count) { throw 'No contract tests found' }

if (($tests | Where-Object { $_.Name -match 'browser.*\.test\.js$' }) -and [string]::IsNullOrWhiteSpace($env:PLAYWRIGHT_MODULE)) {
    $playwrightVersion = '1.63.0'
    $testDependencyDir = Join-Path ([System.IO.Path]::GetTempPath()) "task-horizon-release-tests-$playwrightVersion"
    $playwrightModule = Join-Path $testDependencyDir 'node_modules/playwright'
    if (-not (Test-Path -LiteralPath (Join-Path $playwrightModule 'package.json') -PathType Leaf)) {
        & npm install --prefix $testDependencyDir --no-save --no-package-lock --ignore-scripts "playwright@$playwrightVersion"
        if ($LASTEXITCODE -ne 0) { throw 'Playwright test dependency installation failed' }
    }
    $browserInstallArgs = @('install', 'chromium')
    if ($IsLinux) { $browserInstallArgs = @('install', '--with-deps', 'chromium') }
    & node (Join-Path $playwrightModule 'cli.js') @browserInstallArgs
    if ($LASTEXITCODE -ne 0) { throw 'Chromium test browser installation failed' }
    $env:PLAYWRIGHT_MODULE = $playwrightModule
}

foreach ($test in $tests) {
    & node $test.FullName
    if ($LASTEXITCODE -ne 0) { throw "Test failed: $($test.Name)" }
}

& node (Join-Path $root 'scripts/check-task-writer-boundary.js') --strict
if ($LASTEXITCODE -ne 0) { throw 'Task writer boundary check failed' }

$standaloneScripts = @('index.js', 'ai.js', 'calendar-view.js', 'homepage.js', 'quickbar.js', 'kernel.js', 'src/ai/agent-workbench.js')
foreach ($relativePath in $standaloneScripts) {
    $path = Join-Path $root $relativePath
    & node --check $path
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $relativePath" }
}

$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $root 'src/task-horizon')).Path
$manifestPath = Join-Path $sourceRoot 'manifest.main.json'
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$builder = New-Object System.Text.StringBuilder
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ('task-horizon-main-' + [System.Guid]::NewGuid().ToString('N') + '.js')

try {
    foreach ($relativePath in @($manifest.scripts)) {
        $path = (Resolve-Path -LiteralPath (Join-Path $sourceRoot ([string]$relativePath))).Path
        if (-not $path.StartsWith($sourceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Manifest script escaped source root: $relativePath"
        }
        $repoRelativePath = ('src/task-horizon/' + ([string]$relativePath).Replace('\', '/'))
        $trackedPath = @(& git -C $root ls-files -- $repoRelativePath)
        if ($LASTEXITCODE -ne 0 -or -not ($trackedPath -contains $repoRelativePath)) {
            throw "Manifest script is not tracked by Git: $repoRelativePath"
        }
        $null = $builder.AppendLine((Get-Content -Raw -Encoding UTF8 -LiteralPath $path))
    }
    [System.IO.File]::WriteAllText($tempFile, $builder.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    & node --check $tempFile
    if ($LASTEXITCODE -ne 0) { throw 'Merged task runtime syntax check failed' }
} finally {
    if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force }
}

Write-Host ("Release verification passed: {0} tests" -f $tests.Count)
