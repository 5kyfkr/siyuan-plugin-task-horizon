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

    # 重置所有文件的时间戳为中国时间 (UTC+8)
    $chinaTime = [DateTime]::UtcNow.AddHours(8)
    Get-ChildItem -Path $tempDir -Recurse -File | ForEach-Object {
        try { $_.LastWriteTime = $chinaTime } catch {}
        try { $_.CreationTime = $chinaTime } catch {}
    }

    if (Test-Path -LiteralPath $output) {
        Remove-Item -LiteralPath $output -Force
    }

    $zipped = $false
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $output, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        $zipped = $true
    } catch {
        $zipped = $false
    }
    if (-not $zipped) {
        Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $output -Force -CompressionLevel Optimal
    }

    Write-Host ("Pack success: {0}" -f $output)
} finally {
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}
