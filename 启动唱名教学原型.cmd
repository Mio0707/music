@echo off
chcp 65001 >nul
cd /d "%~dp0"
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v DASHSCOPE_API_KEY 2^>nul') do set "DASHSCOPE_API_KEY=%%B"
python prototype\server.py --port 4174
pause
