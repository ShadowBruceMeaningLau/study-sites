#Requires -Version 5.1
<#
  ============================================================================
   tray.ps1 -- system-tray launcher for the five study sites.

   Turns the old black window (start-all.cmd + node serve-all.mjs) into a tray
   icon: the servers run in the background with no window at all, and the
   right-click menu starts / stops / restarts them, opens the sites, and shows
   the LAN addresses for phone / tablet.

   Three design rules:
     * ONE service implementation -- still tools/serve-all.mjs. The tray only
       starts it, watches its ports and stops it; it copies none of its logic,
       so "served by the tray" and "served from the command line" are identical.
     * NO window anywhere -- the child process is started with CreateNoWindow
       and its output is redirected to tools/logs/.
     * NO user files touched -- the only system change is the HKCU Run key for
       the "start at logon" switch (no admin rights, removable from the menu).

   Usage (normally you just double-click start-tray.vbs):
     powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden `
                -File tools\tray.ps1 [-OpenBrowser] [-NoStart]
     powershell -NoProfile -ExecutionPolicy Bypass -File tools\tray.ps1 -SelfTest

   ---------------------------------------------------------------------------
   WHY THIS FILE IS 100% ASCII (do not "fix" it by adding Chinese here):
   Windows PowerShell 5.1 reads a .ps1 without a BOM as ANSI. Chinese text would
   then be decoded as the system code page, which swallows following bytes and
   breaks parsing -- and because the tray runs with no console, that failure is
   completely silent. All user-visible Chinese lives in tools/tray-strings.json
   and is read below with an explicit UTF-8 decoder, so no BOM is ever needed.
   tools/verify-browser.ps1 is ASCII-only for the same reason.
  ============================================================================
#>
[CmdletBinding()]
param(
  # Open the five sites once the servers are ready (never used by logon autostart)
  [switch]$OpenBrowser,
  # Show the tray but do not start the servers
  [switch]$NoStart,
  # No UI: run start -> probe -> resolve LAN -> stop -> check-for-orphans
  [switch]$SelfTest,
  # Diagnostic: run the real "exit" path after N seconds
  [int]$ExitAfterSeconds = 0
)

$ErrorActionPreference = 'Continue'

# ---------------------------------------------------------------- paths
$ToolsDir   = $PSScriptRoot
$Root       = Split-Path -Parent $ToolsDir
$ServeAll   = Join-Path $ToolsDir 'serve-all.mjs'
$LogDir     = Join-Path $ToolsDir 'logs'
$LogFile    = Join-Path $LogDir 'serve-all.log'
$ConfigPath = Join-Path $ToolsDir 'tray-config.json'
$StringsPath = Join-Path $ToolsDir 'tray-strings.json'
$StartVbs   = Join-Path $Root 'start-tray.vbs'

$RunKey  = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'DSH-StudySites-Tray'

# ---------------------------------------------------------------- UI strings
# Read with an explicit UTF-8 decoder: works whether or not the JSON has a BOM.
$script:Strings = $null
try {
  if (Test-Path $StringsPath) {
    $script:Strings = [System.IO.File]::ReadAllText($StringsPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  }
} catch { $script:Strings = $null }

function T([string]$key, [string]$fallback) {
  if ($null -ne $script:Strings) {
    $p = $script:Strings.PSObject.Properties[$key]
    if ($p -and $null -ne $p.Value -and "$($p.Value)" -ne '') { return [string]$p.Value }
  }
  return $fallback
}

# ---------------------------------------------------------------- sites
# Ports and folders must match SITES in tools/serve-all.mjs
$SITES = @(
  [pscustomobject]@{ key = 'cs';         dir = 'cs';         port = 8123; label = (T 'site.cs' 'CS') },
  [pscustomobject]@{ key = 'math';       dir = 'math';       port = 8124; label = (T 'site.math' 'Math') },
  [pscustomobject]@{ key = 'physics';    dir = 'physics';    port = 8125; label = (T 'site.physics' 'Physics') },
  [pscustomobject]@{ key = 'philosophy'; dir = 'philosophy'; port = 8126; label = (T 'site.philosophy' 'Philosophy') },
  [pscustomobject]@{ key = 'llm';        dir = 'llm';        port = 8127; label = (T 'site.llm' 'LLM/AI') }
)

# node.exe (if missing we fall back to file:// , same as start-all.cmd does)
$NodeExe = $null
$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCmd) { $NodeExe = $nodeCmd.Source }
elseif ($env:ProgramFiles -and (Test-Path (Join-Path $env:ProgramFiles 'nodejs\node.exe'))) {
  $NodeExe = Join-Path $env:ProgramFiles 'nodejs\node.exe'
}

# ---------------------------------------------------------------- config
$script:Config = [pscustomobject]@{ lan = $true; balloon = $true }
if (Test-Path $ConfigPath) {
  try {
    $loaded = Get-Content -Path $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -ne $loaded.lan)     { $script:Config.lan = [bool]$loaded.lan }
    if ($null -ne $loaded.balloon) { $script:Config.balloon = [bool]$loaded.balloon }
  } catch { /* broken config: keep defaults */ }
}
function Save-Config {
  try {
    $json = $script:Config | ConvertTo-Json
    [System.IO.File]::WriteAllText($ConfigPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  } catch { }
}

# ---------------------------------------------------------------- servers
$script:Child  = $null      # cmd.exe wrapper; node is its child
$script:Status = [pscustomobject]@{ up = 0; states = @{}; childAlive = $false; external = $false }

function Get-ServeMode { if ($script:Config.lan) { '--lan' } else { '--local' } }

function Start-Servers {
  if (-not $NodeExe) { return $false }
  if (-not (Test-Path $ServeAll)) { return $false }
  if ($script:Child -and -not $script:Child.HasExited) { return $true }

  if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
  try {
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 1MB)) {
      Move-Item -Path $LogFile -Destination ($LogFile + '.1') -Force
    }
  } catch { }

  $mode  = Get-ServeMode
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $LogFile -Value ("`r`n===== $stamp  tray: starting servers ($mode) =====") -Encoding UTF8

  # cmd is used only to get file redirection for the child's output.
  # CreateNoWindow + UseShellExecute=false keeps every window out of sight.
  # --from-tray tells serve-all.mjs to print tray instructions instead of
  # "close this window / Ctrl+C" (its output here goes to a log file).
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName         = $env:ComSpec
  $psi.Arguments        = '/c ""' + $NodeExe + '" "' + $ServeAll + '" ' + $mode + ' --from-tray >> "' + $LogFile + '" 2>&1"'
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute  = $false
  $psi.CreateNoWindow   = $true
  try { $script:Child = [System.Diagnostics.Process]::Start($psi) }
  catch { $script:Child = $null; return $false }
  return $true
}

function Stop-Servers {
  # Kill the whole tree (cmd -> node), otherwise node is left as an orphan.
  if ($script:Child -and -not $script:Child.HasExited) {
    try { & "$env:SystemRoot\System32\taskkill.exe" /PID $script:Child.Id /T /F 2>&1 | Out-Null } catch { }
    try { [void]$script:Child.WaitForExit(3000) } catch { }
  }
  $script:Child = $null
}

# ---------------------------------------------------------------- probing
function Test-SiteUp([int]$port) {
  # HEAD request proves the port really serves THIS site (not some other program)
  for ($i = 0; $i -lt 2; $i++) {
    try {
      $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$port/index.html")
      $req.Method  = 'HEAD'
      $req.Timeout = 1200
      $req.Proxy   = $null
      $resp = $req.GetResponse()
      $code = [int]$resp.StatusCode
      $resp.Close()
      if ($code -eq 200) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 120
  }
  return $false
}

function Update-Status {
  $states = @{}
  $up = 0
  foreach ($s in $SITES) {
    $ok = Test-SiteUp $s.port
    $states[$s.key] = $ok
    if ($ok) { $up++ }
  }
  $childAlive = [bool]($script:Child -and -not $script:Child.HasExited)
  $script:Status = [pscustomobject]@{
    up         = $up
    states     = $states
    childAlive = $childAlive
    external   = ($up -gt 0 -and -not $childAlive)   # ports up, but not our child
  }
  return $script:Status
}

function Get-LanUrls([int]$port) {
  # Same ordering rule as tools/serve-all.mjs: real adapters first, virtual last
  $virtual = 'wsl|hyper-v|vmware|virtualbox|loopback|docker|tailscale|zerotier'
  $real = New-Object System.Collections.ArrayList
  $virt = New-Object System.Collections.ArrayList
  try {
    foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
      if ($ni.OperationalStatus -ne 'Up') { continue }
      foreach ($ip in $ni.GetIPProperties().UnicastAddresses) {
        if ($ip.Address.AddressFamily -ne 'InterNetwork') { continue }
        if ([System.Net.IPAddress]::IsLoopback($ip.Address)) { continue }
        $url = 'http://' + $ip.Address.ToString() + ':' + $port + '/index.html'
        if ($ni.Name -match $virtual) { [void]$virt.Add($url) } else { [void]$real.Add($url) }
      }
    }
  } catch { }
  return @($real) + @($virt)
}

function Get-SiteUrl($site) {
  if ($NodeExe) { return 'http://127.0.0.1:' + $site.port + '/index.html' }
  # No node: open the files directly (same behaviour as start-all.cmd)
  return 'file:///' + ((Join-Path $Root (Join-Path $site.dir 'index.html')) -replace '\\', '/')
}

function Open-Url([string]$url) {
  try { Start-Process $url | Out-Null } catch { }
}

function Open-AllSites { foreach ($s in $SITES) { Open-Url (Get-SiteUrl $s) } }

# ---------------------------------------------------------------- autostart
function Get-Autostart {
  try {
    $v = (Get-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue).$RunName
    return [bool]$v
  } catch { return $false }
}
function Set-Autostart([bool]$on) {
  try {
    if ($on) {
      if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
      # wscript + .vbs: nothing flashes at logon, and no browser is opened
      $wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
      Set-ItemProperty -Path $RunKey -Name $RunName -Value ('"' + $wscript + '" "' + $StartVbs + '"')
      return $true
    }
    Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
    return $false
  } catch { return $false }
}

# ---------------------------------------------------------------- single instance
$script:Mutex = New-Object System.Threading.Mutex($false, 'Local\DSH-StudySitesTray')
$isFirst = $false
try { $isFirst = $script:Mutex.WaitOne(0) } catch { $isFirst = $true }

# ================================================================ self test
if ($SelfTest) {
  $script:fail = 0
  function Check($name, $ok, $detail) {
    if ($ok) { $tag = 'PASS' } else { $tag = 'FAIL'; $script:fail++ }
    Write-Host ("  [{0}] {1}{2}" -f $tag, $name, $(if ($detail) { "  -- $detail" } else { '' }))
  }
  Write-Host ''
  Write-Host ('===== tray launcher self test =====')
  Write-Host ("  root      {0}" -f $Root)
  Write-Host ("  node      {0}" -f $(if ($NodeExe) { $NodeExe } else { T 'selftest.nonode' 'not found (file:// fallback)' }))
  Write-Host ("  service   {0}" -f $(if (Test-Path $ServeAll) { T 'selftest.serveok' 'serve-all.mjs present' } else { T 'selftest.servemissing' 'MISSING' }))
  Write-Host ''

  $busy = @($SITES | Where-Object { Test-SiteUp $_.port })
  if ($busy.Count -gt 0) {
    Write-Host ('  ' + (T 'selftest.note' 'ports {0} already serving; stop them first') -f (($busy | ForEach-Object { $_.port }) -join ', '))
    exit 2
  }

  Check (T 'selftest.start' 'servers start (no window)') (Start-Servers) $(if ($NodeExe) { '' } else { 'no node' })

  $deadline = (Get-Date).AddSeconds(12)
  $st = $null
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    $st = Update-Status
    if ($st.up -eq 5) { break }
    if ($script:Child -and $script:Child.HasExited) { break }
  }
  Check (T 'selftest.ready' 'all five sites answer HTTP 200') ($st.up -eq 5) ((T 'selftest.up' '{0}/5 up') -f $st.up)
  Check (T 'selftest.alive' 'server process alive') ([bool]($script:Child -and -not $script:Child.HasExited)) ''
  Check (T 'selftest.log' 'log written (banner present)') ((Test-Path $LogFile) -and ((Get-Content $LogFile -Raw -Encoding UTF8) -match "\u5b66\u4e60\u7ad9\u5df2\u542f\u52a8")) $LogFile

  $lanAll = @()
  foreach ($s in $SITES) { $lanAll += @(Get-LanUrls $s.port) }
  $lan = @($lanAll | Where-Object { $_ -notmatch '^http://(127\.|169\.254\.)' })
  Check (T 'selftest.lan' 'LAN address for phone resolved') ($lan.Count -ge 1) $(if ($lan.Count) { $lan[0] } else { T 'selftest.nolan' 'no non-virtual IPv4 found' })
  $tail = if (Test-Path $LogFile) { [string](Get-Content $LogFile -Raw -Encoding UTF8) } else { '' }
  Check (T 'selftest.logtray' 'log tail points at the tray, not a console window') ($tail -match ([regex]::Escape((T 'log.stopTray' 'x')))) ''
  Check (T 'selftest.shim' 'autostart shim present') (Test-Path $StartVbs) $StartVbs

  Stop-Servers
  Start-Sleep -Milliseconds 900
  $after = Update-Status
  Check (T 'selftest.released' 'ports released after stop') ($after.up -eq 0) ((T 'selftest.still' '{0}/5 still answering') -f $after.up)

  $orphan = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
              Where-Object { $_.CommandLine -and $_.CommandLine.Contains('serve-all.mjs') -and $_.CommandLine.Contains($Root) })
  Check (T 'selftest.orphan' 'no orphan node server') ($orphan.Count -eq 0) ((T 'selftest.left' '{0} left') -f $orphan.Count)

  Write-Host ''
  if ($script:fail -eq 0) { Write-Host ('OK  ' + (T 'selftest.pass' 'all checks passed')); exit 0 }
  Write-Host ('NG  ' + ((T 'selftest.fail' '{0} check(s) failed') -f $script:fail)); exit 1
}

# ================================================================ second instance
if (-not $isFirst) {
  # Tray already running: silent when launched by logon autostart, and it just
  # opens the sites when the user clicks the launcher again.
  if ($OpenBrowser) { Open-AllSites }
  exit 0
}

# ================================================================ tray UI
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Icons are drawn at runtime so no .ico file is needed.
function New-TrayIcon([string]$phase) {
  try {
    $bmp = New-Object System.Drawing.Bitmap 32, 32
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    switch ($phase) {
      'run'     { $c = [System.Drawing.Color]::FromArgb(255, 22, 138, 74) }   # green: 5/5
      'partial' { $c = [System.Drawing.Color]::FromArgb(255, 196, 122, 8) }   # amber: some up
      default   { $c = [System.Drawing.Color]::FromArgb(255, 110, 116, 126) } # grey: stopped
    }
    $brush = New-Object System.Drawing.SolidBrush $c
    $g.FillEllipse($brush, 1, 1, 30, 30)
    $glyph = T 'iconGlyph' '4'
    $font  = New-Object System.Drawing.Font('Microsoft YaHei UI', 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt   = New-Object System.Drawing.StringFormat
    $fmt.Alignment     = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect  = New-Object System.Drawing.RectangleF 0, 0, 32, 32
    $g.DrawString($glyph, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
    $g.Dispose()
    $tmp = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    $clone = $tmp.Clone()   # an independent copy: it does not depend on that HICON
    $bmp.Dispose()
    return $clone
  } catch {
    return [System.Drawing.SystemIcons]::Application
  }
}
$script:IconRun     = New-TrayIcon 'run'
$script:IconPartial = New-TrayIcon 'partial'
$script:IconStop    = New-TrayIcon 'stop'

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon    = $script:IconStop
$notify.Text    = T 'appName' 'Study sites'
$notify.Visible = $true

# ---------------------------------------------------------------- menu
# NOTE: Items.Add("text") returns an index (int), so menu entries must be built
# as ToolStripMenuItem objects -- this bit the first draft.
function New-Mi([string]$text, [scriptblock]$onClick) {
  $mi = New-Object System.Windows.Forms.ToolStripMenuItem $text
  if ($onClick) { $mi.Add_Click($onClick) }
  return $mi
}
function New-Sep { return (New-Object System.Windows.Forms.ToolStripSeparator) }

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miStatus = New-Mi (T 'menu.statusStarting' 'Status: starting...')
$miStatus.Enabled = $false
[void]$menu.Items.Add($miStatus)
[void]$menu.Items.Add((New-Sep))

$miOpenAll = New-Mi (T 'menu.openAll' 'Open all five sites') { Open-AllSites }
[void]$menu.Items.Add($miOpenAll)

$miSite = @{}
foreach ($s in $SITES) {
  $site = $s
  $mi = New-Mi ((T 'menu.site' '  {0}  -  127.0.0.1:{1}') -f $s.label, $s.port) { Open-Url (Get-SiteUrl $site) }.GetNewClosure()
  $miSite[$s.key] = $mi
  [void]$menu.Items.Add($mi)
}

$miLan = New-Mi (T 'menu.lan' 'Phone / tablet (same WiFi)')
[void]$menu.Items.Add($miLan)
[void]$menu.Items.Add((New-Sep))

$miService = New-Mi (T 'menu.service' 'Service')
$miStart   = New-Mi (T 'menu.start' 'Start servers') {
  if (Start-Servers) { Update-Ui }
  else { [void][System.Windows.Forms.MessageBox]::Show((T 'dialog.startFail' 'Could not start: check Node.js or tools\logs\serve-all.log.'), (T 'appName' 'Study sites')) }
}
$miStop    = New-Mi (T 'menu.stop' 'Stop servers') { Stop-Servers; Start-Sleep -Milliseconds 600; Update-Ui }
$miRestart = New-Mi (T 'menu.restart' 'Restart servers') { Stop-Servers; Start-Sleep -Milliseconds 600; [void](Start-Servers); Start-Sleep -Milliseconds 300; Update-Ui }
$miLocal   = New-Mi (T 'menu.localOnly' 'Local access only (no phone)') {
  # CheckOnClick already flipped it: checked == local only == lan off
  $script:Config.lan = -not $miLocal.Checked
  Save-Config
  Stop-Servers
  Start-Sleep -Milliseconds 400
  [void](Start-Servers)
  Update-Ui
}
$miLocal.CheckOnClick = $true
$miLog = New-Mi (T 'menu.log' 'View log') {
  if (Test-Path $LogFile) { Start-Process notepad.exe $LogFile | Out-Null }
  else { [void][System.Windows.Forms.MessageBox]::Show((T 'dialog.noLog' 'No log yet: the servers never started.'), (T 'appName' 'Study sites')) }
}
# Recovery path: if the servers were started some other way (a console window, or
# a tray that got killed from Task Manager), the tray does not own them and the
# Stop entry stays disabled -- this lets the user take the ports back.
$miKill = New-Mi (T 'menu.killExternal' 'Stop servers started elsewhere') {
  $answer = [System.Windows.Forms.MessageBox]::Show(
    (T 'dialog.killExternalText' 'Servers on ports 8123-8127 were started outside this tray. Stop them now?'),
    (T 'dialog.killExternalTitle' 'Study sites'),
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Warning)
  if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
  foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)) {
    if ($p.CommandLine -and $p.CommandLine.Contains('serve-all.mjs') -and $p.CommandLine.Contains($Root)) {
      try { & "$env:SystemRoot\System32\taskkill.exe" /PID $p.ProcessId /T /F 2>&1 | Out-Null } catch { }
    }
  }
  Start-Sleep -Milliseconds 700
  Update-Ui
}
[void]$miService.DropDownItems.Add($miStart)
[void]$miService.DropDownItems.Add($miStop)
[void]$miService.DropDownItems.Add($miRestart)
[void]$miService.DropDownItems.Add((New-Sep))
[void]$miService.DropDownItems.Add($miLocal)
[void]$miService.DropDownItems.Add($miLog)
[void]$miService.DropDownItems.Add($miKill)
[void]$menu.Items.Add($miService)

$miBalloon = New-Mi (T 'menu.balloonToggle' 'Ready balloon on start') {
  $script:Config.balloon = $miBalloon.Checked
  Save-Config
}
$miBalloon.CheckOnClick = $true
[void]$menu.Items.Add($miBalloon)

$miAutostart = New-Mi (T 'menu.autostart' 'Start at logon (servers only, no browser)') {
  $now = Set-Autostart ([bool]$miAutostart.Checked)
  $miAutostart.Checked = $now
  if ($script:Config.balloon) {
    $msg = if ($now) { T 'balloon.autostartOn' 'Autostart enabled.' } else { T 'balloon.autostartOff' 'Autostart disabled.' }
    $notify.ShowBalloonTip(3000, (T 'appName' 'Study sites'), $msg, [System.Windows.Forms.ToolTipIcon]::Info)
  }
}
$miAutostart.CheckOnClick = $true
[void]$menu.Items.Add($miAutostart)

[void]$menu.Items.Add((New-Sep))
$miAbout = New-Mi (T 'menu.about' 'About') {
  [void][System.Windows.Forms.MessageBox]::Show((T 'dialog.aboutText' 'Five study sites.'), (T 'dialog.aboutTitle' 'Study sites'))
}
[void]$menu.Items.Add($miAbout)

$miExit = New-Mi (T 'menu.exit' 'Exit (stops servers)') { Invoke-TrayExit }
[void]$menu.Items.Add($miExit)

$notify.ContextMenuStrip = $menu

# One exit path only: the menu item and -ExitAfterSeconds both call this, so
# "exiting really stops the servers" is a tested claim, not a comment.
function Invoke-TrayExit {
  Stop-Servers
  $notify.Visible = $false
  $timer.Stop()
  $script:Context.ExitThread()
}

# ---------------------------------------------------------------- status
$script:PendingOpen = [bool]$OpenBrowser
$script:Announced   = $false

function Update-Ui {
  $st = Update-Status
  $down = @($SITES | Where-Object { -not $st.states[$_.key] } | ForEach-Object { $_.label })

  if ($st.up -eq 5) {
    $notify.Icon = $script:IconRun
    $miStatus.Text = T 'menu.statusRunning' 'Status: running (5/5)'
  } elseif ($st.up -eq 0) {
    $notify.Icon = $script:IconStop
    if ($NodeExe) { $miStatus.Text = T 'menu.statusStopped' 'Status: stopped' }
    else { $miStatus.Text = T 'menu.statusNoNode' 'Status: Node.js not found' }
  } else {
    $notify.Icon = $script:IconPartial
    $miStatus.Text = (T 'menu.statusPartial' 'Status: {0}/5 up ({1} down)') -f $st.up, ($down -join ', ')
  }
  if ($st.external) { $miStatus.Text = $miStatus.Text + (T 'menu.statusExternal' ' - started elsewhere') }

  foreach ($s in $SITES) {
    $item = $miSite[$s.key]
    $item.Enabled = [bool]$st.states[$s.key]
    $suffix = ''
    if (-not $st.states[$s.key]) { $suffix = T 'menu.siteDown' ' (not running)' }
    $item.Text = ((T 'menu.site' '  {0}  -  127.0.0.1:{1}') -f $s.label, $s.port) + $suffix
  }
  $miStart.Enabled   = -not $st.childAlive
  $miStop.Enabled    = [bool]$st.childAlive
  $miRestart.Enabled = [bool]$NodeExe
  $miKill.Enabled    = [bool]$st.external

  $short = T 'short.stopped' 'stopped'
  if ($st.up -eq 5) { $short = T 'short.running' 'running 5/5' }
  elseif ($st.up -gt 0) { $short = (T 'short.partial' 'partial {0}/5') -f $st.up }
  $notify.Text = (T 'tooltip' 'Study sites - {0}') -f $short
  if ($notify.Text.Length -gt 60) { $notify.Text = $notify.Text.Substring(0, 60) }

  if ($script:PendingOpen -and $st.up -eq 5) {
    $script:PendingOpen = $false
    Open-AllSites
  }
  if (-not $script:Announced -and $st.up -eq 5) {
    $script:Announced = $true
    if ($script:Config.balloon) {
      $notify.ShowBalloonTip(4000, (T 'balloon.readyTitle' 'Sites ready'), (T 'balloon.readyText' 'Right-click the tray icon to open them.'), [System.Windows.Forms.ToolTipIcon]::Info)
    }
  }
}

# The phone submenu is rebuilt every time it opens, so a network change does
# not require restarting the tray.
$miLan.Add_DropDownOpening({
  $miLan.DropDownItems.Clear()
  $any = $false
  foreach ($s in $SITES) {
    $urls = @(Get-LanUrls $s.port)
    if ($urls.Count -eq 0) { continue }
    $any = $true
    $url = $urls[0]
    $sub = New-Mi ($s.label + '  ' + $url) { Open-Url $url }.GetNewClosure()
    [void]$miLan.DropDownItems.Add($sub)
  }
  if (-not $any) {
    $none = New-Mi (T 'menu.lanNone' '(no LAN address found)')
    $none.Enabled = $false
    [void]$miLan.DropDownItems.Add($none)
    return
  }
  [void]$miLan.DropDownItems.Add((New-Sep))
  $copy = New-Mi (T 'menu.lanCopy' 'Copy all phone addresses') {
    $lines = @()
    foreach ($s in $SITES) {
      $u = @(Get-LanUrls $s.port)
      if ($u.Count) { $lines += ($s.label + '  ' + $u[0]) }
    }
    if ($lines.Count) { [System.Windows.Forms.Clipboard]::SetText(($lines -join "`r`n")) }
  }
  [void]$miLan.DropDownItems.Add($copy)
})

$menu.Add_Opening({
  $miLocal.Checked     = -not $script:Config.lan
  $miBalloon.Checked   = [bool]$script:Config.balloon
  $miAutostart.Checked = Get-Autostart
  Update-Ui
})

$notify.Add_DoubleClick({ Open-AllSites })
$notify.Add_MouseClick({
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
    $hint = (T 'balloon.clickHint' 'Double-click to open all five sites.')
    $notify.ShowBalloonTip(2500, (T 'appName' 'Study sites'), ($notify.Text + "`r`n" + $hint), [System.Windows.Forms.ToolTipIcon]::Info)
  }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({ Update-Ui })
$timer.Start()

# Diagnostic: leave via the real exit path after N seconds
$exitTimer = $null
if ($ExitAfterSeconds -gt 0) {
  $exitTimer = New-Object System.Windows.Forms.Timer
  $exitTimer.Interval = [Math]::Min($ExitAfterSeconds * 1000, 2147483647)
  $exitTimer.Add_Tick({ $exitTimer.Stop(); Invoke-TrayExit })
  $exitTimer.Start()
}

# ---------------------------------------------------------------- go
if (-not $NoStart) { [void](Start-Servers) }
Update-Ui

$script:Context = New-Object System.Windows.Forms.ApplicationContext
try {
  [System.Windows.Forms.Application]::Run($script:Context)
} finally {
  # Never leave an unmanaged node process behind, however we exit
  Stop-Servers
  $notify.Visible = $false
  $notify.Dispose()
  try { $script:Mutex.ReleaseMutex() } catch { }
}
