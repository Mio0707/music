@echo off
chcp 65001 >nul
cd /d "%~dp0"
py audio-production\studio\server.py --open
echo.
echo 音乐分轨台已经停止。按任意键关闭窗口。
pause >nul
