@echo off
title Check Services
color 0E
cls
echo.
echo ========================================
echo    KIEM TRA DICH VU
echo ========================================
echo.

echo [PostgreSQL]
sc query postgresql-x64-16 | find "RUNNING" > nul
if %errorlevel% neq 0 (
    echo Status: STOPPED
    echo Khoi dong: net start postgresql-x64-16
) else (
    echo Status: RUNNING
)

echo.
echo [Redis]
powershell -Command "Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet" > nul 2>&1
if %errorlevel% neq 0 (
    echo Status: STOPPED
    echo Khoi dong: redis-server
    echo Hoac: "C:\Program Files\Redis\redis-server.exe"
) else (
    echo Status: RUNNING
)

echo.
echo [PM2]
pm2 status

echo.
pause
