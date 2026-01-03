# Dual Claude Command Line Windows
# Positions two PowerShell windows side by side at full height

# Windows API definitions
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class WinAPI {
        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_SHOWWINDOW = 0x0040;
        public const int SW_MAXIMIZE = 3;
        public const int SW_RESTORE = 9;
    }
"@

# Get screen dimensions
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$screenWidth = $screen.Width
$screenHeight = $screen.Height
$screenTop = $screen.Top

# Calculate window dimensions (half width, full height)
$windowWidth = [math]::Floor($screenWidth / 2)
$windowHeight = $screenHeight

# Start first PowerShell window
Write-Host "Starting first Claude instance (left side)..."
$process1 = Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "claude" -PassThru
Start-Sleep -Milliseconds 1500  # Wait for window to appear

# Get window handle and position left window
$hwnd1 = $process1.MainWindowHandle
if ($hwnd1 -ne [IntPtr]::Zero) {
    [WinAPI]::ShowWindow($hwnd1, [WinAPI]::SW_RESTORE)
    [WinAPI]::SetWindowPos($hwnd1, [IntPtr]::Zero, 0, $screenTop, $windowWidth, $windowHeight,
        [WinAPI]::SWP_NOZORDER -bor [WinAPI]::SWP_SHOWWINDOW)
    Write-Host "Left window positioned at (0, $screenTop) - ${windowWidth}x${windowHeight}"
}

# Start second PowerShell window
Write-Host "Starting second Claude instance (right side)..."
$process2 = Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "claude" -PassThru
Start-Sleep -Milliseconds 1500

# Get window handle and position right window
$hwnd2 = $process2.MainWindowHandle
if ($hwnd2 -ne [IntPtr]::Zero) {
    [WinAPI]::ShowWindow($hwnd2, [WinAPI]::SW_RESTORE)
    [WinAPI]::SetWindowPos($hwnd2, [IntPtr]::Zero, $windowWidth, $screenTop, $windowWidth, $windowHeight,
        [WinAPI]::SWP_NOZORDER -bor [WinAPI]::SWP_SHOWWINDOW)
    Write-Host "Right window positioned at ($windowWidth, $screenTop) - ${windowWidth}x${windowHeight}"
}

Write-Host "`nBoth Claude instances are running side by side!"
Write-Host "Press Ctrl+C to exit this script (Claude windows will remain open)"

# Optional: Keep windows positioned (uncomment to enable)
# WARNING: This will continuously reposition windows every 2 seconds
# Uncomment the block below if you want windows to stick together when moved

<#
Write-Host "`nMonitoring window positions... (Ctrl+C to stop)"
while ($true) {
    Start-Sleep -Seconds 2

    # Reposition left window
    if ($hwnd1 -ne [IntPtr]::Zero) {
        [WinAPI]::SetWindowPos($hwnd1, [IntPtr]::Zero, 0, $screenTop, $windowWidth, $windowHeight,
            [WinAPI]::SWP_NOZORDER -bor [WinAPI]::SWP_SHOWWINDOW)
    }

    # Reposition right window
    if ($hwnd2 -ne [IntPtr]::Zero) {
        [WinAPI]::SetWindowPos($hwnd2, [IntPtr]::Zero, $windowWidth, $screenTop, $windowWidth, $windowHeight,
            [WinAPI]::SWP_NOZORDER -bor [WinAPI]::SWP_SHOWWINDOW)
    }
}
#>

# Keep script running so window handles remain valid
try {
    while ($true) {
        Start-Sleep -Seconds 10
    }
} catch {
    Write-Host "`nScript terminated."
}
