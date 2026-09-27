# Captures the real Tiled editor for the article GIF: level.tmj as authored, and
# the browser's exported level-edited.tmj with the Bridge layer selected, plain
# and with View > Highlight Current Layer. Tiled runs at 150 % on a 4K display
# (DISPLAY2 here), and captures are in physical pixels.
# Tiled's session file and registry preferences are backed up and restored.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot -replace '\\', '/'
$frames = Join-Path $PSScriptRoot 'frames'
$tiled = 'C:\Program Files\Tiled\tiled.exe'
$session = Join-Path $env:APPDATA 'Tiled\default.tiled-session'
$backup = Join-Path $env:TEMP 'roundtrip-tiled-backup'

Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Win {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  public struct RECT { public int L, T, R, B; }
}
'@
[Win]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null # per-monitor v2: physical pixels
$prefs = 'HKCU:\Software\mapeditor.org\Tiled\Interface'

function Capture([IntPtr]$hwnd, [string]$name) {
  $r = New-Object Win+RECT
  [Win]::GetWindowRect($hwnd, [ref]$r) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dc = $g.GetHdc()
  [Win]::PrintWindow($hwnd, $dc, 2) | Out-Null
  $g.ReleaseHdc($dc); $g.Dispose()
  $bmp.Save((Join-Path $frames $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Open-Tiled([string]$file, [bool]$highlight) {
  Set-ItemProperty $prefs HighlightCurrentLayer ($highlight ? 'true' : 'false')
  # Bridge is layer index 2 (bottom-up). Tiled zooms in physical pixels: 0.375 shows 864x480.
  $state = @{ scale = 0.375; selectedLayer = 2; viewCenter = @{ x = 1152; y = 640 } }
  @{
    activeFile = "$root/$file"; expandedProjectPaths = @(); project = ''
    fileStates = @{ "$root/$file" = $state }
    openFiles = @("$root/$file"); recentFiles = @("$root/$file")
  } | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $session
  $p = Start-Process $tiled -PassThru
  for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 200; $p.Refresh() }
  $h = $p.MainWindowHandle
  [Win]::ShowWindow($h, 9) | Out-Null # SW_RESTORE, in case it was saved maximized
  [Win]::SetWindowPos($h, [IntPtr]::Zero, 4040, 200, 2000, 1150, 0x40) | Out-Null
  (New-Object -ComObject WScript.Shell).AppActivate($p.Id) | Out-Null
  [Win]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Seconds 3
  return $p
}

New-Item -ItemType Directory -Force $backup | Out-Null
Copy-Item $session (Join-Path $backup 'default.tiled-session') -Force
reg export 'HKCU\Software\mapeditor.org\Tiled' (Join-Path $backup 'tiled.reg') /y | Out-Null
try {
  # The first launch lays out the view before the window is resized; it only
  # stores the window geometry for the launches that follow.
  foreach ($shot in @(
      @('level.tmj', $false, $null),
      @('level.tmj', $false, 'tiled-before.png'),
      @('level-edited.tmj', $false, 'tiled-after.png'),
      @('level-edited.tmj', $true, 'tiled-after-highlight.png'))) {
    $p = Open-Tiled $shot[0] $shot[1]
    if ($shot[2]) { Capture $p.MainWindowHandle $shot[2] }
    $p.CloseMainWindow() | Out-Null; $p.WaitForExit(10000) | Out-Null
  }
} finally {
  Get-Process tiled -ErrorAction SilentlyContinue | Stop-Process -Force
  Copy-Item (Join-Path $backup 'default.tiled-session') $session -Force
  reg delete 'HKCU\Software\mapeditor.org\Tiled' /f | Out-Null
  reg import (Join-Path $backup 'tiled.reg') 2>$null
}
