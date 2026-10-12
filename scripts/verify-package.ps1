param([string]$PackagePath = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
if ([string]::IsNullOrWhiteSpace($PackagePath)) { $PackagePath = Join-Path $root 'package.zip' }
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) { throw 'Python 3 is required, as for build.ps1' }
& $python.Source (Join-Path $root 'scripts/verify-package.py') $PackagePath
if ($LASTEXITCODE -ne 0) { throw 'Package verification failed' }
