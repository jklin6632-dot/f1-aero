@echo off
rem ---------- F1 AERO launcher ----------
rem start the local static server when needed, then open the page.
setlocal
set "ROOT=%~dp0"
set "NODE=node"
where node >nul 2>nul || set "NODE=C:\Users\21530\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"

call :probe
if not errorlevel 1 goto open

start "f1-aero server" /min "%NODE%" "%ROOT%serve.mjs"
call :wait
if errorlevel 1 (
  echo [F1 AERO] server did not start on 127.0.0.1:8141
  pause
  exit /b 1
)

:open
start "" "http://127.0.0.1:8141/"
exit /b 0

:probe
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',8141);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
exit /b %errorlevel%

:wait
powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 20;$i++){try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',8141);$c.Close();exit 0}catch{Start-Sleep -Milliseconds 500}};exit 1" >nul 2>&1
exit /b %errorlevel%
