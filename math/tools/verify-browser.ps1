# ============================================================
#  数学站浏览器级验证：用无头 Edge/Chrome 真实渲染多条路由，
#  把 DOM 存到 tools\_dom\*.html，再交给 verify-dom.mjs 断言。
#  用法：powershell -File tools\verify-browser.ps1
# ============================================================
$ErrorActionPreference = 'Continue'
$base = Split-Path -Parent $PSScriptRoot
$candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $null
foreach ($c in $candidates) { if (Test-Path $c) { $browser = $c; break } }
if (-not $browser) { Write-Output "[错误] 未找到 Edge 或 Chrome。"; exit 1 }
Write-Output ("使用浏览器: " + $browser)

$domDir = Join-Path $base "tools\_dom"
if (-not (Test-Path $domDir)) { New-Item -ItemType Directory -Path $domDir | Out-Null }
$profileDir = Join-Path $base ".edge-profile"
$urlBase = "file:///" + ($base -replace '\\', '/') + "/index.html#"

$routes = [ordered]@{
  "home"           = "/"
  "path"           = "/path"
  "course"         = "/c/math-analysis-1"
  "lesson-limits"  = "/c/math-analysis-1/ma1-sequence"
  "lesson-formula" = "/c/math-analysis-1/ma1-real-numbers"
  "lesson-la"      = "/c/linear-algebra-2/la2-eigenvalue"
  "lesson-prob"    = "/c/probability/prob-limit-theorems"
  "lesson-cv"      = "/c/complex-analysis/cv-series-residue"
  "lesson-ode"     = "/c/ode/ode-constant-coefficient"
  "lesson-ra"      = "/c/real-analysis/ra-integral"
  "lesson-zero"    = "/c/math-zero-basics/mz-symbols-basic"
  "notebook"       = "/notebook"
  "review"         = "/review"
  "glossary"       = "/glossary"
  "roadmap"        = "/roadmap"
}

foreach ($name in $routes.Keys) {
  $out = Join-Path $domDir "$name.html"
  $args = @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter', '--no-first-run',
    "--user-data-dir=$profileDir", '--virtual-time-budget=10000', '--dump-dom', ($urlBase + $routes[$name])
  )
  Write-Output ("  渲染 " + $name + " ...")
  if (Test-Path $out) { Remove-Item $out -Force }
  cmd.exe /c ('"' + $browser + '" ' + (($args | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' > "' + $out + '" 2>nul')
}

# 公式渲染自检页（单独一个文件，不走路由）
$demoOut = Join-Path $domDir "math-demo.html"
$demoUrl = "file:///" + ($base -replace '\\', '/') + "/tools/math-demo.html"
$demoArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter', '--no-first-run',
  "--user-data-dir=$profileDir", '--virtual-time-budget=10000', '--dump-dom', $demoUrl
)
Write-Output "  渲染 math-demo ..."
if (Test-Path $demoOut) { Remove-Item $demoOut -Force }
cmd.exe /c ('"' + $browser + '" ' + (($demoArgs | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' > "' + $demoOut + '" 2>nul')

node (Join-Path $base "tools\verify-dom.mjs")
exit $LASTEXITCODE
