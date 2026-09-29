$ErrorActionPreference = 'Stop'

Set-Location 'c:\Users\ASUS\Desktop\APP'
$env:EXPO_NO_DEPENDENCY_VALIDATION = '1'

npx expo start --lan --port 8082 *>&1 | Tee-Object -FilePath 'expo-go-8082.log'
