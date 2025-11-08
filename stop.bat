@echo off
title Stop Sudoku Server
color 0C
echo.
echo ========================================
echo    DUNG SUDOKU SERVER
echo ========================================
echo.

echo [*] Dang dung PM2...
pm2 stop sudoku-server
pm2 delete sudoku-server

echo.
echo [OK] Server da dung!
echo.

pause
