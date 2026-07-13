param(
    [Parameter(Mandatory = $true)]
    [string[]] $Semester,

    [string] $Activate
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $syncArguments = @(
        'run', '--group', 'spider', 'python', '-m', 'catalog_spider', 'sync-lessons'
    )
    foreach ($name in $Semester) {
        $syncArguments += @('--semester', $name)
    }
    if ($Activate) {
        $syncArguments += @('--activate', $Activate)
    }

    & uv @syncArguments
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & uv run python -m catalog_spider validate-lessons --all
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
