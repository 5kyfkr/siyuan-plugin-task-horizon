$ErrorActionPreference = 'Stop'

$pluginDir = Split-Path -Parent $PSCommandPath
$output = Join-Path $pluginDir 'package.zip'
$pluginJson = Join-Path $pluginDir 'plugin.json'
$pluginName = (Get-Content -Raw -Encoding UTF8 -LiteralPath $pluginJson | ConvertFrom-Json).name
if ([string]::IsNullOrWhiteSpace($pluginName)) { throw 'plugin.json name missing' }

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('plugin_build_' + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null

function Resolve-TaskHorizonManifestScriptPaths {
    param(
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [Parameter(Mandatory = $true)][string]$SourceRoot
    )

    $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $ManifestPath | ConvertFrom-Json
    $scripts = @($manifest.scripts)
    if (-not $scripts.Count) {
        throw 'src/task-horizon/manifest.main.json scripts missing'
    }

    $resolvedRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
    $resolvedFiles = New-Object System.Collections.Generic.List[string]
    foreach ($item in $scripts) {
        $raw = [string]$item
        if ([string]::IsNullOrWhiteSpace($raw)) { continue }
        $normalized = ($raw -replace '\\', '/').Trim()
        if ([string]::IsNullOrWhiteSpace($normalized)) { continue }
        $segments = $normalized.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
        if (-not $segments.Length) { continue }
        if ($segments -contains '.' -or $segments -contains '..') {
            throw "Invalid src/task-horizon manifest script path: $raw"
        }
        $candidate = Join-Path $SourceRoot ($segments -join [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "Missing src/task-horizon manifest script: $raw"
        }
        $resolvedCandidate = (Resolve-Path -LiteralPath $candidate).Path
        if (-not $resolvedCandidate.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Manifest script escaped src/task-horizon root: $raw"
        }
        $resolvedFiles.Add($resolvedCandidate)
    }

    if (-not $resolvedFiles.Count) {
        throw 'src/task-horizon/manifest.main.json scripts empty after normalization'
    }

    return $resolvedFiles
}

function Build-TaskHorizonMainFromManifest {
    param(
        [Parameter(Mandatory = $true)][string]$TempPluginDir
    )

    $sourceRoot = Join-Path $TempPluginDir 'src\task-horizon'
    $manifestPath = Join-Path $sourceRoot 'manifest.main.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        return
    }

    $builder = New-Object System.Text.StringBuilder
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $scriptPaths = Resolve-TaskHorizonManifestScriptPaths -ManifestPath $manifestPath -SourceRoot $sourceRoot
    $resolvedRoot = (Resolve-Path -LiteralPath $sourceRoot).Path.TrimEnd('\', '/')
    foreach ($scriptPath in $scriptPaths) {
        $relativePath = $scriptPath.Substring($resolvedRoot.Length).TrimStart('\', '/').Replace('\', '/')
        $null = $builder.AppendLine("/* task-horizon build: begin $relativePath */")
        $null = $builder.AppendLine((Get-Content -Raw -Encoding UTF8 -LiteralPath $scriptPath))
        $null = $builder.AppendLine()
        $null = $builder.AppendLine("/* task-horizon build: end $relativePath */")
        $null = $builder.AppendLine()
    }

    [System.IO.File]::WriteAllText((Join-Path $TempPluginDir 'task.js'), $builder.ToString(), $utf8NoBom)
    Remove-Item -LiteralPath $sourceRoot -Recurse -Force
}

try {
    $excludePaths = @(
        '.git',
        '.gitignore',
        '.impeccable.md',
        '.github',
        '.history',
        '.idea',
        '.vscode',
        '.DS_Store',
        'node_modules',
        'docs',
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

    Get-ChildItem -Path $pluginDir -Exclude $excludePaths | Copy-Item -Destination $tempDir -Recurse -Force
    Build-TaskHorizonMainFromManifest -TempPluginDir $tempDir

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
