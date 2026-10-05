# 注册「榜单采集」计划任务：每 24 小时依次运行 Supjav / TokyoMotion / JavBunny 采集，错过则开机补跑
# 注销: Unregister-ScheduledTask -TaskName "榜单采集" -Confirm:$false

$ErrorActionPreference = "Stop"
$taskName = "榜单采集"
$node = (Get-Command node -ErrorAction Stop).Source

$supjavAction = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $PSScriptRoot 'supjav-collect.mjs')`"" -WorkingDirectory $PSScriptRoot
$tokyomotionAction = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $PSScriptRoot 'tokyomotion-collect.mjs')`"" -WorkingDirectory $PSScriptRoot
$javbunnyAction = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $PSScriptRoot 'javbunny-collect.mjs')`"" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 24) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $taskName -Action $supjavAction, $tokyomotionAction, $javbunnyAction -Trigger $trigger -Settings $settings -Force -Description "Supjav/TokyoMotion/JavBunny 日/周/月榜单采集并上传（每 24 小时；日志 tools/*.log）"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State

