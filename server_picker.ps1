# ZeroScript Bridge - MCP server picker (WinForms, LamByy Premium UI v3)
# Returns the choice via exit code: 1 = VS Code, 2 = Roblox, 3 = Both, 0 = cancel.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# --- palette -----------------------------------------------------------------
$bg        = [System.Drawing.Color]::FromArgb(10, 10, 16)
$card      = [System.Drawing.Color]::FromArgb(20, 20, 28)
$cardTop   = [System.Drawing.Color]::FromArgb(26, 26, 36)
$textMain  = [System.Drawing.Color]::FromArgb(245, 245, 250)
$textSub   = [System.Drawing.Color]::FromArgb(170, 170, 188)
$textDim   = [System.Drawing.Color]::FromArgb(110, 110, 128)
$gold      = [System.Drawing.Color]::FromArgb(230, 192, 123)
$goldDim   = [System.Drawing.Color]::FromArgb(140, 116, 74)
$border    = [System.Drawing.Color]::FromArgb(38, 38, 50)

$vsTop     = [System.Drawing.Color]::FromArgb(0, 130, 230)
$vsBot     = [System.Drawing.Color]::FromArgb(0, 90, 180)
$rbTop     = [System.Drawing.Color]::FromArgb(235, 70, 70)
$rbBot     = [System.Drawing.Color]::FromArgb(190, 40, 40)
$btTop     = [System.Drawing.Color]::FromArgb(55, 180, 105)
$btBot     = [System.Drawing.Color]::FromArgb(30, 130, 70)

$FORM_W = 460
$FORM_H = 420

# --- form --------------------------------------------------------------------
$form                 = New-Object System.Windows.Forms.Form
$form.Text            = 'ZeroScript Bridge'
$form.ClientSize      = New-Object System.Drawing.Size($FORM_W, $FORM_H)
$form.StartPosition   = 'CenterScreen'
$form.FormBorderStyle = 'None'
$form.BackColor       = $bg
$form.ForeColor       = $textMain
$form.Font            = New-Object System.Drawing.Font('Segoe UI', 10)
$form.TopMost         = $true
# DoubleBuffered is Protected in WinForms - set it via reflection (PS 5.1
# cannot assign it directly: "property 'DoubleBuffered' cannot be found").
try {
    $dbProp = $form.GetType().GetProperty('DoubleBuffered', [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic -bor [System.Reflection.BindingFlags]::Public)
    if ($dbProp) { $dbProp.SetValue($form, $true, $null) }
} catch {}

# --- title bar ---------------------------------------------------------------
$titleBar           = New-Object System.Windows.Forms.Panel
$titleBar.Location  = New-Object System.Drawing.Point(0, 0)
$titleBar.Size      = New-Object System.Drawing.Size($FORM_W, 48)
$titleBar.BackColor = $card
$form.Controls.Add($titleBar)

$drag = @{ x = 0; y = 0 }
$titleBar.Add_MouseDown({ $drag.x = $_.X; $drag.y = $_.Y })
$titleBar.Add_MouseMove({
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $form.Left += ($_.X - $drag.x)
        $form.Top  += ($_.Y - $drag.y)
    }
})

# gold accent line at bottom of title bar
$strip           = New-Object System.Windows.Forms.Panel
$strip.Location  = New-Object System.Drawing.Point(0, 46)
$strip.Size      = New-Object System.Drawing.Size($FORM_W, 2)
$strip.BackColor = $gold
$form.Controls.Add($strip)

# left gold dot indicator
$dot           = New-Object System.Windows.Forms.Panel
$dot.Location  = New-Object System.Drawing.Point(16, 19)
$dot.Size      = New-Object System.Drawing.Size(10, 10)
$dot.BackColor = $gold
$form.Controls.Add($dot)
# make it round via Region
try {
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddEllipse(0, 0, 10, 10)
    $dot.Region = New-Object System.Drawing.Region($gp)
} catch {}

$titleLabel           = New-Object System.Windows.Forms.Label
$titleLabel.Text      = 'ZeroScript Bridge'
$titleLabel.Location  = New-Object System.Drawing.Point(34, 14)
$titleLabel.AutoSize  = $true
$titleLabel.Font      = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = $textMain
$titleBar.Controls.Add($titleLabel)

$subTitle           = New-Object System.Windows.Forms.Label
$subTitle.Text      = 'LamByy UI'
$subTitle.Location  = New-Object System.Drawing.Point(($FORM_W - 118), 16)
$subTitle.AutoSize  = $true
$subTitle.Font      = New-Object System.Drawing.Font('Segoe UI', 8, [System.Drawing.FontStyle]::Bold)
$subTitle.ForeColor = $gold
$titleBar.Controls.Add($subTitle)

$closeBtn            = New-Object System.Windows.Forms.Button
$closeBtn.Text       = [char]0x2715
$closeBtn.Location   = New-Object System.Drawing.Point(($FORM_W - 44), 12)
$closeBtn.Size       = New-Object System.Drawing.Size(32, 24)
$closeBtn.FlatStyle  = 'Flat'
$closeBtn.FlatAppearance.BorderSize = 0
$closeBtn.BackColor  = $card
$closeBtn.ForeColor  = $textDim
$closeBtn.Font       = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$closeBtn.Cursor     = [System.Windows.Forms.Cursors]::Hand
$closeBtn.Add_MouseEnter({ $closeBtn.ForeColor = [System.Drawing.Color]::FromArgb(235, 70, 70) })
$closeBtn.Add_MouseLeave({ $closeBtn.ForeColor = $textDim })
$closeBtn.Add_Click({ $script:choice = 0; $form.Close() })
$titleBar.Controls.Add($closeBtn)

# --- headline ----------------------------------------------------------------
$head            = New-Object System.Windows.Forms.Label
$head.Text       = 'Select MCP server'
$head.Location   = New-Object System.Drawing.Point(26, 72)
$head.AutoSize   = $true
$head.Font       = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$head.ForeColor  = $textMain
$form.Controls.Add($head)

$subLbl           = New-Object System.Windows.Forms.Label
$subLbl.Text      = 'Only the chosen server will be launched by the bridge.'
$subLbl.Location  = New-Object System.Drawing.Point(28, 108)
$subLbl.AutoSize  = $true
$subLbl.Font      = New-Object System.Drawing.Font('Segoe UI', 9)
$subLbl.ForeColor = $textSub
$form.Controls.Add($subLbl)

# --- gradient button factory -------------------------------------------------
$script:choice = 0

function New-GradientButton {
    param(
        [int]$X, [int]$Y, [int]$W, [int]$H,
        [int]$Value,
        [System.Drawing.Color]$Top,
        [System.Drawing.Color]$Bot
    )

    $b           = New-Object System.Windows.Forms.Button
    $b.Location  = New-Object System.Drawing.Point($X, $Y)
    $b.Size      = New-Object System.Drawing.Size($W, $H)
    $b.FlatStyle = 'Flat'
    $b.FlatAppearance.BorderSize = 0
    $b.BackColor = $Bot
    $b.ForeColor = [System.Drawing.Color]::White
    $b.Text      = ''
    $b.Cursor    = [System.Windows.Forms.Cursors]::Hand
    $b.Tag       = $Value

    # gradient paint via Paint event (only paints bg, controls go on top).
    # Colours are stashed on the control itself (TopColor/BotColor) so the
    # Paint handler does not depend on the enclosing function's scope - and
    # the brush is built with ::new() in ONE line, because New-Object cannot
    # parse a multi-line constructor call with a trailing comma (PS 5.1:
    # "Cannot find an overload for LinearGradientBrush and the argument count 4").
    $b | Add-Member -NotePropertyName TopColor -NotePropertyValue $Top -Force
    $b | Add-Member -NotePropertyName BotColor -NotePropertyValue $Bot -Force
    $b.Add_Paint({
        param($sender, $e)
        $rect = $sender.ClientRectangle
        if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
            try {
                $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $sender.TopColor, $sender.BotColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
                $e.Graphics.FillRectangle($brush, $rect)
                $brush.Dispose()
            } catch {}
        }
    })

    $b.Add_Click({ $script:choice = [int]$this.Tag; $form.Close() })
    return $b
}

$btnW = $FORM_W - 52
$btnH = 66
$btnX = 26
$btnY1 = 142
$btnY2 = 220
$btnY3 = 298

$btnVs = New-GradientButton -X $btnX -Y $btnY1 -W $btnW -H $btnH -Value 1 -Top $vsTop -Bot $vsBot
$btnRb = New-GradientButton -X $btnX -Y $btnY2 -W $btnW -H $btnH -Value 2 -Top $rbTop -Bot $rbBot
$btnBt = New-GradientButton -X $btnX -Y $btnY3 -W $btnW -H $btnH -Value 3 -Top $btTop -Bot $btBot

function Add-ButtonContent {
    param($Button, [string]$Icon, [string]$Title, [string]$Desc)

    # icon badge (dark circle with the icon)
    $badge           = New-Object System.Windows.Forms.Label
    $badge.Text      = $Icon
    $badge.Location  = New-Object System.Drawing.Point(16, 14)
    $badge.Size      = New-Object System.Drawing.Size(40, 38)
    $badge.Font      = New-Object System.Drawing.Font('Consolas', 13, [System.Drawing.FontStyle]::Bold)
    $badge.ForeColor = [System.Drawing.Color]::White
    $badge.BackColor = [System.Drawing.Color]::FromArgb(60, 0, 0, 0)
    $badge.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $badge.Add_Click({ $script:choice = [int]$Button.Tag; $form.Close() }.GetNewClosure())
    $Button.Controls.Add($badge)

    $lblT            = New-Object System.Windows.Forms.Label
    $lblT.Text       = $Title
    $lblT.Location   = New-Object System.Drawing.Point(70, 12)
    $lblT.AutoSize   = $true
    $lblT.Font       = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
    $lblT.ForeColor  = [System.Drawing.Color]::White
    $lblT.BackColor  = [System.Drawing.Color]::Transparent
    $lblT.Add_Click({ $script:choice = [int]$Button.Tag; $form.Close() }.GetNewClosure())
    $Button.Controls.Add($lblT)

    $lblD            = New-Object System.Windows.Forms.Label
    $lblD.Text       = $Desc
    $lblD.Location   = New-Object System.Drawing.Point(70, 36)
    $lblD.AutoSize   = $true
    $lblD.Font       = New-Object System.Drawing.Font('Segoe UI', 8)
    $lblD.ForeColor  = [System.Drawing.Color]::FromArgb(230, 230, 240)
    $lblD.BackColor  = [System.Drawing.Color]::Transparent
    $lblD.Add_Click({ $script:choice = [int]$Button.Tag; $form.Close() }.GetNewClosure())
    $Button.Controls.Add($lblD)

    # Hover: set the hand cursor on every child control up front (doing it
    # inside Add_MouseEnter broke in PS 5.1 - $Button / $lblT are not in scope
    # there without .GetNewClosure(), and a bare MouseEnter on the parent
    # button does NOT fire while the pointer is over a child label, so the
    # hover looked dead for most of the button's area anyway).
    $badge.Cursor = [System.Windows.Forms.Cursors]::Hand
    $lblT.Cursor  = [System.Windows.Forms.Cursors]::Hand
    $lblD.Cursor  = [System.Windows.Forms.Cursors]::Hand
    $Button.Cursor = [System.Windows.Forms.Cursors]::Hand
}

Add-ButtonContent -Button $btnVs -Icon '</>' -Title 'VS Code'       -Desc 'Full editor + file & terminal tools'
Add-ButtonContent -Button $btnRb -Icon 'RBX' -Title 'Roblox Studio' -Desc 'Build and edit the open place'
Add-ButtonContent -Button $btnBt -Icon '++'  -Title 'Both'          -Desc 'Connect VS Code and Roblox together'

$form.Controls.Add($btnVs)
$form.Controls.Add($btnRb)
$form.Controls.Add($btnBt)

# --- footer hint -------------------------------------------------------------
$foot           = New-Object System.Windows.Forms.Label
$foot.Text      = 'Esc  -  cancel' + [char]0x2003 + [char]0x2003 + '|' + [char]0x2003 + [char]0x2003 + 'Drag title bar to move'
$foot.Location  = New-Object System.Drawing.Point(26, ($FORM_H - 30))
$foot.AutoSize  = $true
$foot.Font      = New-Object System.Drawing.Font('Segoe UI', 8)
$foot.ForeColor = $textDim
$form.Controls.Add($foot)

$form.AcceptButton = $null
$form.CancelButton = $null
$form.KeyPreview   = $true
$form.Add_KeyDown({ if ($_.KeyCode -eq 'Escape') { $script:choice = 0; $form.Close() } })

# --- rounded corners ---------------------------------------------------------
try {
    $radius = 14
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $radius, $radius, 180, 90)
    $path.AddArc($FORM_W - $radius, 0, $radius, $radius, 270, 90)
    $path.AddArc($FORM_W - $radius, $FORM_H - $radius, $radius, $radius, 0, 90)
    $path.AddArc(0, $FORM_H - $radius, $radius, $radius, 90, 90)
    $path.CloseFigure()
    $form.Region = New-Object System.Drawing.Region($path)
} catch {}

[void]$form.ShowDialog()

exit $script:choice
