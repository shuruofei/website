@echo off
chcp 65001 >nul
title 桦艺新生网站服务器
cd /d %~dp0
echo ============================================
echo   桦艺新生 - 桦树皮画数字体验平台
echo   启动后浏览器将自动打开网站
echo   关闭本窗口即可停止网站
echo ============================================
echo.
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:5000"
D:\Pythen312\python.exe app.py
pause
