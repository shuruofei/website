@echo off
chcp 65001 >nul
title 桦艺新生 - 局域网共享启动
cd /d %~dp0

echo 正在尝试放行 Windows 防火墙 5000 端口（需管理员权限，失败不影响本机运行）...
netsh advfirewall firewall add rule name="Huayi Flask 5000" dir=in action=allow protocol=TCP localport=5000 >nul 2>&1
if errorlevel 1 (
    echo [提示] 未能自动放行防火墙。请右键本文件选“以管理员身份运行”一次，
    echo        或手动在管理员命令行执行：
    echo        netsh advfirewall firewall add rule name="Huayi Flask 5000" dir=in action=allow protocol=TCP localport=5000
)

echo.
echo ============================================
echo   把下面的地址发给队员，用浏览器打开即可
echo   （10.52 开头 = 校园网；172.23 开头 = ZeroTier）
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 地址"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do echo   http://%%b:5000
)
echo ============================================
echo.
echo 关闭本窗口即可停止网站
if exist "D:\Pythen312\python.exe" (
    "D:\Pythen312\python.exe" app.py
) else (
    python app.py
)
pause
