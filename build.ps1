$ErrorActionPreference = 'Stop'

$pluginDir = Split-Path -Parent $PSCommandPath
$output = Join-Path $pluginDir 'package.zip'
$pluginJson = Join-Path $pluginDir 'plugin.json'
$pluginName = (Get-Content -Raw -Encoding UTF8 -LiteralPath $pluginJson | ConvertFrom-Json).name
if ([string]::IsNullOrWhiteSpace($pluginName)) { throw 'plugin.json name missing' }

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('plugin_build_' + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    Copy-Item -Path (Join-Path $pluginDir '*') -Destination $tempDir -Recurse -Force

    $removePaths = @(
        '.git',
        '.gitignore',
        '.github',
        '.history',
        '.idea',
        '.vscode',
        '.DS_Store',
        'node_modules',
        'GUIDE_zh_CN.md',
        'REPRO_SYNC.md',
        'CHANGELOG.md',
        'LICENSE',
        'package.zip',
        'build.sh',
        'build.bat',
        'build.ps1',
        '.hotreload'
    )

    foreach ($p in $removePaths) {
        $full = Join-Path $tempDir $p
        if (Test-Path -LiteralPath $full) {
            Remove-Item -LiteralPath $full -Recurse -Force
        }
    }

    Get-ChildItem -Path $tempDir -Filter '*.zip' -File -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Force } catch {}
    }

    if (Test-Path -LiteralPath $output) {
        Remove-Item -LiteralPath $output -Force
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $output, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    Write-Host ("Pack success: {0}" -f $output)
} finally {
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}
