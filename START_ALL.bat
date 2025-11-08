@echo off
title Sudoku Server - All In One
color 0A
cls
echo.
echo ========================================
echo    SUDOKU SERVER - ALL IN ONE
echo ========================================
echo.

echo [1/3] Khoi dong Redis...
start "Redis Server" /MIN cmd /c start-redis.bat
timeout /t 3 /nobreak > nul
echo [OK] Redis da khoi dong

echo [2/3] Kiem tra PostgreSQL...
sc query postgresql-x64-16 | find "RUNNING" > nul
if %errorlevel% neq 0 (
    echo [!] PostgreSQL chua chay, dang khoi dong...
    net start postgresql-x64-16
) else (
    echo [OK] PostgreSQL dang chay
)

echo [3/3] Khoi dong game server...
pm2 start ecosystem.config.js
timeout /t 2 /nobreak > nul

echo.
echo ========================================
echo    SERVER DA KHOI DONG!
echo ========================================
echo.
echo Truy cap game:
echo   http://localhost:3000
echo   http://10.216.72.91:3000
echo.
echo Nhan phim bat ky de xem logs...
pause > nul

pm2 logs
