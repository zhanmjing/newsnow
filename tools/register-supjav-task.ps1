# 注册「Supjav 榜采集」计划任务：每 6 小时运行一次，错过则开机补跑
# 注销: Unregister-ScheduledTask -TaskName "Supjav榜采集" -Confirm:$false

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "supjav-collect.mjs"
$taskName = "Supjav榜采集"
$node = (Get-Command node -ErrorAction Stop).Source

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$scriptPath`"" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force -Description "Supjav 日/周/月三榜采集并上传（每 6 小时，日志 tools/supjav.log）"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State
