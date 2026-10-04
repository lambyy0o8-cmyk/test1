@echo off
chcp 65001 >nul
title LamByy System
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [LamByy] Node.js не найден. Установи: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo [LamByy] Первый запуск - устанавливаю зависимости...
  call npm install
  if errorlevel 1 (
    echo [LamByy] npm install не удался.
    pause
    exit /b 1
  )
)

echo [LamByy] Запускаю приложение...
call npm start
