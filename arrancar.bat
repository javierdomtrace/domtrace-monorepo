@echo off
echo Arrancando Stoqly...

:: API
cd /d "C:\app stoqly\domtrace-monorepo"
start "API Stoqly" cmd /k "pnpm dev:api"

:: Panel web
start "Panel Stoqly" cmd /k "pnpm dev:panel"

:: PostgreSQL shell (instalación local)
start "PSQL Stoqly" cmd /k ""C:\Program Files\PostgreSQL\16\bin\psql.exe" postgresql://domtrace:password@localhost:5432/domtrace"

echo.
echo Abriendo el panel en 5 segundos...
timeout /t 5 /nobreak > nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:5173
if errorlevel 1 start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" http://localhost:5173
