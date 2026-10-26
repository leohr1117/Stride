$ErrorActionPreference = 'Continue'
$root = 'C:\Users\Administrator\ascend'
$node = 'C:\Program Files\nodejs\node.exe'
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$logDir = Join-Path $root 'betrieb'
$desktop = 'C:\Users\Administrator\Desktop'
$serverPid = Join-Path $logDir 'server.pid'
$tunnelPid = Join-Path $logDir 'tunnel.pid'
$serverOut = Join-Path $logDir 'server.out.log'
$serverErr = Join-Path $logDir 'server.err.log'
$tunnelOut = Join-Path $logDir 'tunnel.out.log'
$tunnelErr = Join-Path $logDir 'tunnel.err.log'
$domainPid = Join-Path $logDir 'domain.pid'
$domainErr = Join-Path $logDir 'domain.err.log'
$domainOut = Join-Path $logDir 'domain.out.log'
$domainCfg = 'C:\Users\Administrator\.cloudflared\stride.yml'
$dienstLog = Join-Path $logDir 'dienst.log'
$urlDatei = Join-Path $logDir 'url.txt'
$desktopDatei = Join-Path $desktop 'Ascend-Adresse.txt'
$mutex = New-Object System.Threading.Mutex($false, 'Global\AscendDienst')
if (-not $mutex.WaitOne(0, $false)) { exit 0 }

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$script:serverHaengt = 0
$script:letzteUrl = ''

function Write-Log([string]$text) {
  $zeile = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text
  Add-Content -Path $dienstLog -Value $zeile -Encoding UTF8
}

function Test-PidDatei([string]$pfad) {
  if (-not (Test-Path $pfad)) { return $false }
  $text = Get-Content $pfad -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $text) { return $false }
  return $null -ne (Get-Process -Id ([int]$text) -ErrorAction SilentlyContinue)
}

function Stop-PidDatei([string]$pfad) {
  if (-not (Test-Path $pfad)) { return }
  $text = Get-Content $pfad -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($text) {
    Stop-Process -Id ([int]$text) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $pfad -Force -ErrorAction SilentlyContinue
}

function Test-PortOffen([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $port)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Protect-Log([string]$pfad) {
  if ((Test-Path $pfad) -and (Get-Item $pfad).Length -gt 5MB) {
    Move-Item $pfad "$pfad.alt" -Force -ErrorAction SilentlyContinue
  }
}

function Read-Shared([string]$pfad) {
  if (-not (Test-Path $pfad)) { return '' }
  $stream = $null
  $reader = $null
  try {
    $stream = [System.IO.File]::Open($pfad, 'Open', 'Read', 'ReadWrite')
    $reader = New-Object System.IO.StreamReader($stream)
    return $reader.ReadToEnd()
  } catch {
    return ''
  } finally {
    if ($reader) { $reader.Close() } elseif ($stream) { $stream.Close() }
  }
}

function Update-Adresse {
  $muster = 'https://[a-z0-9-]+\.trycloudflare\.com'
  $text = (Read-Shared $tunnelOut) + (Read-Shared $tunnelErr)
  $treffer = [regex]::Matches($text, $muster)
  if ($treffer.Count -eq 0) { return }
  $url = $treffer[$treffer.Count - 1].Value
  if ($url -eq $script:letzteUrl) { return }
  $script:letzteUrl = $url
  Set-Content -Path $urlDatei -Value $url -Encoding ASCII
  Set-Content -Path $desktopDatei -Value $url -Encoding ASCII
  Write-Log "Adresse $url"
}

function Start-Server {
  Protect-Log $serverOut
  Protect-Log $serverErr
  $prozess = Start-Process -FilePath $node -ArgumentList @('--disable-warning=ExperimentalWarning', 'server/index.ts') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru
  Set-Content -Path $serverPid -Value $prozess.Id -Encoding ASCII
  Write-Log "Server gestartet $($prozess.Id)"
}

function Start-Tunnel {
  Protect-Log $tunnelOut
  Protect-Log $tunnelErr
  $prozess = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:3000') -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru
  Set-Content -Path $tunnelPid -Value $prozess.Id -Encoding ASCII
  Write-Log "Tunnel gestartet $($prozess.Id)"
}

function Start-DomainTunnel {
  Protect-Log $domainOut
  Protect-Log $domainErr
  $prozess = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--no-autoupdate', '--config', $domainCfg, 'run') -WindowStyle Hidden -RedirectStandardOutput $domainOut -RedirectStandardError $domainErr -PassThru
  Set-Content -Path $domainPid -Value $prozess.Id -Encoding ASCII
  Write-Log "Domain-Tunnel gestartet $($prozess.Id)"
}

Write-Log 'Dienst gestartet'
while ($true) {
  $portOffen = Test-PortOffen 3000
  if ($portOffen) {
    $script:serverHaengt = 0
  } elseif (Test-PidDatei $serverPid) {
    $script:serverHaengt += 1
    if ($script:serverHaengt -ge 6) {
      Write-Log 'Server haengt, Neustart'
      Stop-PidDatei $serverPid
      $script:serverHaengt = 0
      Start-Server
    }
  } else {
    Start-Server
  }

  if ((Test-PortOffen 3000) -and -not (Test-PidDatei $tunnelPid)) {
    Start-Tunnel
  }
  if ((Test-PortOffen 3000) -and (Test-Path $domainCfg) -and -not (Test-PidDatei $domainPid)) {
    Start-DomainTunnel
  }
  Update-Adresse
  Start-Sleep -Seconds 10
}


