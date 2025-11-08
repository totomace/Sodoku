@echo off
title Sudoku Game Server
color 0A
cls
echo.
echo ========================================
echo    SUDOKU MULTIPLAYER GAME SERVER
echo ========================================
echo.

REM Kiem tra PostgreSQL
echo [1/3] Kiem tra PostgreSQL...
sc query postgresql-x64-16 | find "RUNNING" > nul
if %errorlevel% neq 0 (
    echo [!] PostgreSQL chua chay!
    echo     Vui long mo pgAdmin hoac chay: net start postgresql-x64-16
    echo.
    pause
    exit
) else (
    echo [OK] PostgreSQL dang chay
)

REM Kiem tra Redis
echo [2/3] Kiem tra Redis...
powershell -Command "Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet" > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Redis chua chay!
    echo     Vui long chay Redis tu: C:\Program Files\Redis\redis-server.exe
    echo     Hoac chay: redis-server
    echo.
    pause
    exit
) else (
    echo [OK] Redis dang chay
)

echo [3/3] Khoi dong server...
echo.

REM Khoi dong server voi PM2
pm2 start ecosystem.config.js

echo.
echo ========================================
echo    SERVER DA KHOI DONG!
echo ========================================
echo.
echo Truy cap:
echo   - May nay:       http://localhost:3000
echo   - May khac:      http://10.216.72.91:3000
echo.
echo Nhan phim bat ky de xem logs...
pause > nul

pm2 logs
