@echo off
chcp 65001 >nul
cd /d "%~dp0"
python studio\server.py --port 8766 --open
