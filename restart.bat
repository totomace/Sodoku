@echo off
title Restart Sudoku Server
color 0E
echo.
echo ========================================
echo    RESTART SUDOKU SERVER
echo ========================================
echo.

echo [*] Dang restart server...
pm2 restart sudoku-server

echo.
echo [OK] Server da restart!
echo.

timeout /t 2 >nul
pm2 logs

pause
