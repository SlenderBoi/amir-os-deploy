@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Amir OS - Setup and Launcher
cd /d "%~dp0"

:CHECK_NODE
where node >nul 2>nul
if errorlevel 1 (
  cls
  echo =====================================================
  echo   Node.js is not installed.
  echo =====================================================
  echo.
  echo Install the LTS version from: https://nodejs.org/
  echo Then close this window and run Amir-OS.bat again.
  echo.
  set /p OPENNODE="Open the Node.js download page now? [Y/N]: "
  if /I "!OPENNODE!"=="Y" start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

:MENU
cls
for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
for /f "tokens=*" %%v in ('npm --version') do set NPM_VERSION=%%v
echo =====================================================
echo                NULVAR CORE LAUNCHER
echo =====================================================
echo   Node: !NODE_VERSION!     npm: !NPM_VERSION!
echo   Folder: %CD%
echo =====================================================
echo.
echo   [1] First install / repair dependencies
 echo  [2] Start development mode
 echo  [3] Test and create production build
 echo  [4] Preview production build
 echo  [5] Run automated tests
 echo  [6] Clean reinstall dependencies
 echo  [7] Open project folder
 echo  [0] Exit
 echo.
set /p CHOICE="Choose an option: "

if "%CHOICE%"=="1" goto INSTALL
if "%CHOICE%"=="2" goto DEV
if "%CHOICE%"=="3" goto BUILD
if "%CHOICE%"=="4" goto PREVIEW
if "%CHOICE%"=="5" goto TEST
if "%CHOICE%"=="6" goto CLEAN
if "%CHOICE%"=="7" goto OPEN_FOLDER
if "%CHOICE%"=="0" exit /b 0
goto MENU

:INSTALL
cls
echo Installing exact, locked dependencies...
call npm ci
if errorlevel 1 (
  echo npm ci failed, falling back to npm install...
  call npm install
  if errorlevel 1 goto ERROR
)
call npm run check
if errorlevel 1 goto ERROR
echo.
echo Installation and TypeScript check completed successfully.
pause
goto MENU

:ENSURE_INSTALL
if exist "node_modules\" exit /b 0
echo Dependencies are missing. Installing them first...
call npm ci
if errorlevel 1 (
  echo npm ci failed, falling back to npm install...
  call npm install
  if errorlevel 1 goto ERROR
)
exit /b 0

:DEV
call :ENSURE_INSTALL
cls
echo Starting Amir OS in development mode...
echo The browser will open at http://localhost:5173
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"
call npm run dev
if errorlevel 1 goto ERROR
goto MENU

:BUILD
call :ENSURE_INSTALL
cls
echo Running TypeScript checks, tests, and production build...
call npm run check
if errorlevel 1 goto ERROR
call npm test
if errorlevel 1 goto ERROR
call npm run build
if errorlevel 1 goto ERROR
echo.
echo Production build is ready in the dist folder.
pause
goto MENU

:PREVIEW
call :ENSURE_INSTALL
if not exist "dist\index.html" (
  echo No production build found. Building first...
  call npm run build
  if errorlevel 1 goto ERROR
)
cls
echo Starting production preview...
echo The browser will open at http://localhost:4173
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4173"
call npm run preview
if errorlevel 1 goto ERROR
goto MENU

:TEST
call :ENSURE_INSTALL
cls
call npm run check
if errorlevel 1 goto ERROR
call npm test
if errorlevel 1 goto ERROR
echo.
echo All checks passed.
pause
goto MENU

:CLEAN
cls
echo This removes node_modules and performs a clean locked install.
set /p CONFIRM="Continue? [Y/N]: "
if /I not "%CONFIRM%"=="Y" goto MENU
if exist "node_modules\" rmdir /s /q "node_modules"
call npm cache verify
call npm ci
if errorlevel 1 (
  echo npm ci failed, falling back to npm install...
  call npm install
  if errorlevel 1 goto ERROR
)
echo.
echo Clean installation completed.
pause
goto MENU

:OPEN_FOLDER
start "" "%CD%"
goto MENU

:ERROR
echo.
echo =====================================================
echo An operation failed. Read the error above.
echo You can try option 6 for a clean reinstall.
echo =====================================================
pause
goto MENU
