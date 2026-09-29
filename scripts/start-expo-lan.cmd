@echo off
cd /d C:\Users\ASUS\Desktop\APP
set EXPO_NO_DEPENDENCY_VALIDATION=1
call "C:\Program Files\nodejs\npx.cmd" expo start --lan --port 8082 > "C:\Users\ASUS\Desktop\APP\expo-go-8082.log" 2>&1
