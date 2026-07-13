param(
    [Parameter(Mandatory = $true)]
    [string[]] $Semester,

    [string] $Activate
)

# 此脚本会打开登录浏览器、抓取 raw 数据并发布课程文件。
# raw 已存在且只需重跑转换时，使用：
# uv run python -m catalog_spider build-lessons --semester-key 2026-fall

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
