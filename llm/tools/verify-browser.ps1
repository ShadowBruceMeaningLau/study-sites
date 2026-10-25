# ============================================================
#  Browser-level verification: render index.html routes with
#  headless Edge/Chrome, dump DOM to tools\_dom\*.html, then let
#  verify-dom.mjs assert.
#  Usage: pwsh -File tools\verify-browser.ps1
#  NOTE: intentionally 100% ASCII (see ZERO-BASIS-STANDARD.md red line 1).
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
if (-not $browser) { Write-Output "[ERROR] Edge or Chrome not found; cannot run browser-level verification."; exit 1 }
Write-Output ("Using browser: " + $browser)

$domDir = Join-Path $base "tools\_dom"
if (-not (Test-Path $domDir)) { New-Item -ItemType Directory -Path $domDir | Out-Null }
$profileDir = Join-Path $base ".edge-profile"
$urlBase = "file:///" + ($base -replace '\\', '/') + "/index.html#"

$routes = [ordered]@{
  "home"        = "/"
  "path"        = "/path"
  "course"      = "/c/python-basics-ai"
  "lesson-ph1"  = "/c/python-basics-ai/py-1"
  "notebook"    = "/notebook"
  "review"      = "/review"
  "glossary"    = "/glossary"
  "roadmap"     = "/roadmap"
  "course-llm0" = "/c/llm-zero-basics"
  "lesson-llm0-tok"  = "/c/llm-zero-basics/llm0-token"
  "lesson-llm0-temp" = "/c/llm-zero-basics/llm0-temperature"
  # 2026-10-25 coverage sweep: four new courses + the new final chapter.
  # These exist to prove the new data files are ACTUALLY wired into index.html
  # (validate reads the disk and cannot see a missing <script src>).
  "course-radar"    = "/c/frontier-radar"
  "lesson-radar-1"  = "/c/frontier-radar/radar-1"
  "lesson-radar-4"  = "/c/frontier-radar/radar-4"
  "course-continual" = "/c/continual-learning"
  "lesson-cl-1"     = "/c/continual-learning/cl-1"
  "course-selfevo"  = "/c/self-evolution"
  "course-memory"   = "/c/memory-architecture"
  "lesson-mem-2"    = "/c/memory-architecture/mem-2"
  "course-lalg"     = "/c/learning-algorithms"
  "lesson-lalg-2"   = "/c/learning-algorithms/lalg-2"
}

foreach ($name in $routes.Keys) {
  $out = Join-Path $domDir "$name.html"
  $args = @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter', '--no-first-run',
    "--user-data-dir=$profileDir", '--virtual-time-budget=10000', '--dump-dom', ($urlBase + $routes[$name])
  )
  Write-Output ("  render " + $name + " ...")
  if (Test-Path $out) { Remove-Item $out -Force }
  cmd.exe /c ('"' + $browser + '" ' + (($args | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' > "' + $out + '" 2>nul')
}

# Math render self-check page (single file, not a route)
$demoOut = Join-Path $domDir "math-demo.html"
$demoUrl = "file:///" + ($base -replace '\\', '/') + "/tools/math-demo.html"
$demoArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter', '--no-first-run',
  "--user-data-dir=$profileDir", '--virtual-time-budget=10000', '--dump-dom', $demoUrl
)
Write-Output "  render math-demo ..."
if (Test-Path $demoOut) { Remove-Item $demoOut -Force }
cmd.exe /c ('"' + $browser + '" ' + (($demoArgs | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' > "' + $demoOut + '" 2>nul')

node (Join-Path $base "tools\verify-dom.mjs")
exit $LASTEXITCODE
