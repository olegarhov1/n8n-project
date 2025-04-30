@echo off
cd /d C:\Users\Ronin\n8n-project\admin_page

echo 🔄 Запуск ngrok...
start "" /B ngrok http 5000 > nul

timeout /t 2 > nul

echo 🌐 Получаем ссылку ngrok и обновляем .env...
node set-ngrok-url.js

REM читаем ссылку из .env
for /f "tokens=2 delims==" %%a in ('findstr NGROK_URL .env') do set NGROK_URL=%%a

REM открываем index.html и list.html по публичной ссылке
start "" "%NGROK_URL%/index.html"
start "" "%NGROK_URL%/list.htm"



echo 🚀 Запуск админки...
node adminka.js

pause
