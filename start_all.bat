@echo off
chcp 65001 >nul
title FitAiNess - 전체 서버 시작

echo ============================================
echo   FitAiNess 서버 시작 스크립트
echo ============================================
echo.

REM ── 1) AI 서버 (포트 5000 / Ollama + 식단/운동)
echo [1/4] AI 서버 시작 (port 5000)...
start "AI Server :5000" cmd /k "cd /d %~dp0Ai_server && node server.js"
timeout /t 2 /nobreak >nul

REM ── 2) CNN 서버 (포트 4000 / 음식인식)
echo [2/4] CNN 서버 시작 (port 4000)...
start "CNN Server :4000" cmd /k "cd /d %~dp0Server && node server.js"
timeout /t 2 /nobreak >nul

REM ── 3) 웹 서버 (포트 3000 / 프론트엔드 + 프록시)
echo [3/4] 웹 서버 시작 (port 3000)...
start "Web Server :3000" cmd /k "cd /d %~dp0project_web && node server.js"
timeout /t 3 /nobreak >nul

REM ── 4) Cloudflare Tunnel (포트 3000 외부 노출)
echo [4/4] Cloudflare Tunnel 시작...
echo.
echo *** 잠시 후 https://xxxx.trycloudflare.com URL 이 표시됩니다 ***
echo *** Android 앱의 BASE_URL 을 해당 URL 로 변경하세요 ***
echo.
start "Cloudflare Tunnel" cmd /k "%~dp0cloudflared.exe tunnel --url http://localhost:3000"

echo.
echo ============================================
echo   모든 서버가 시작됐습니다.
echo   로컬 접속:    http://localhost:3000
echo   외부 접속:    Cloudflare Tunnel 창 참조
echo ============================================
pause
