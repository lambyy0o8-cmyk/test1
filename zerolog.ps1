# ZeroScript Bridge - live AI activity window
# Tails logs/ai_actions.log and shows every tool call / result as a coloured
# line, so the user can watch what the agent is doing in real time.
# Each line in the file is:  HH:MM:SS|KIND|text  where KIND is CALL/OK/ERR/INFO.

param(
    [string]$LogPath = (Join-Path $PSScriptRoot 'logs\ai_actions.log')
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$bg       = [System.Drawing.Color]::FromArgb(16, 16, 22)
$card     = [System.Drawing.Color]::FromArgb(26, 26, 34)
$textMain = [System.Drawing.Color]::FromArgb(220, 220, 230)
$textDim  = [System.Drawing.Color]::FromArgb(130, 130, 145)
$colCall  = [System.Drawing.Color]::FromArgb(120, 180, 255)
$colOk    = [System.Drawing.Color]::FromArgb(110, 220, 140)
$colErr   = [System.Drawing.Color]::FromArgb(255, 120, 120)
$colInfo  = [System.Drawing.Color]::FromArgb(170, 170, 185)
$colThink = [System.Drawing.Color]::FromArgb(190, 150, 230)

$FORM_W = 560
$FORM_H = 460

$form                 = New-Object System.Windows.Forms.Form
$form.Text            = 'ZeroScript - AI activity'
$form.ClientSize      = New-Object System.Drawing.Size($FORM_W, $FORM_H)
$form.StartPosition   = 'Manual'
$form.Location        = New-Object System.Drawing.Point(900, 80)
$form.FormBorderStyle = 'Sizable'
$form.MinimumSize     = New-Object System.Drawing.Size(420, 260)
$form.BackColor       = $bg
$form.ForeColor       = $textMain
$form.Font            = New-Object System.Drawing.Font('Consolas', 9.5)

# --- header ------------------------------------------------------------------
$header           = New-Object System.Windows.Forms.Panel
$header.Dock      = 'Top'
$header.Height    = 34
$header.BackColor = $card
$form.Controls.Add($header)

$title           = New-Object System.Windows.Forms.Label
$title.Text      = 'AI activity'
$title.Location  = New-Object System.Drawing.Point(12, 8)
$title.AutoSize  = $true
$title.Font      = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $textMain
$header.Controls.Add($title)

$status           = New-Object System.Windows.Forms.Label
$status.Text      = 'waiting for log...'
$status.Location  = New-Object System.Drawing.Point(140, 10)
$status.AutoSize  = $true
$status.Font      = New-Object System.Drawing.Font('Segoe UI', 8)
$status.ForeColor = $textDim
$header.Controls.Add($status)

# --- activity view -----------------------------------------------------------
$box            = New-Object System.Windows.Forms.RichTextBox
$box.Dock       = 'Fill'
$box.BackColor  = $bg
$box.ForeColor  = $textMain
$box.BorderStyle = 'None'
$box.ReadOnly   = $true
$box.WordWrap   = $true
$box.ScrollBars = 'Vertical'
$box.Font       = New-Object System.Drawing.Font('Consolas', 9.5)
$box.DetectUrls = $false
$form.Controls.Add($box)
$box.BringToFront()

function Append-Line([string]$time, [string]$kind, [string]$text) {
    $color = switch ($kind) {
        'CALL'  { $colCall }
        'OK'    { $colOk }
        'ERR'   { $colErr }
        'THINK' { $colThink }
        default { $colInfo }
    }
    $prefix = switch ($kind) {
        'CALL'  { '->' }
        'OK'    { '<-' }
        'ERR'   { '!!' }
        'THINK' { '..' }
        default { '  ' }
    }
    $box.SelectionStart  = $box.TextLength
    $box.SelectionLength = 0
    $box.SelectionColor  = $textDim
    $box.AppendText("$time  ")
    $box.SelectionColor  = $color
    $box.AppendText("$prefix $text")
    $box.SelectionColor  = $textMain
    $box.AppendText("`r`n")
    $box.SelectionStart  = $box.TextLength
    $box.ScrollToCaret()
}

# Start from the end of the existing file so the window shows only NEW activity.
$script:lastPos = 0
try {
    if (Test-Path $LogPath) { $script:lastPos = (Get-Item $LogPath).Length }
} catch {}

$timer          = New-Object System.Windows.Forms.Timer
$timer.Interval = 400
$timer.Add_Tick({
    try {
        if (-not (Test-Path $LogPath)) {
            $status.Text = 'log not created yet (start the bridge)'
            return
        }
        $len = (Get-Item $LogPath).Length
        if ($len -lt $script:lastPos) { $script:lastPos = 0; $box.Clear() }
        if ($len -eq $script:lastPos) { return }
        $fs = New-Object System.IO.FileStream($LogPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        [void]$fs.Seek($script:lastPos, [System.IO.SeekOrigin]::Begin)
        $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
        while (-not $sr.EndOfStream) {
            $line = $sr.ReadLine()
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $parts = $line.Split('|', 3)
            if ($parts.Count -ge 3) { Append-Line $parts[0] $parts[1] $parts[2] }
            else { Append-Line '' 'INFO' $line }
        }
        $sr.Close()
        $fs.Close()
        $script:lastPos = $len
        $status.Text = 'live'
    } catch {
        $status.Text = 'log read error'
    }
})
$timer.Start()

[void]$form.ShowDialog()
$timer.Stop()
