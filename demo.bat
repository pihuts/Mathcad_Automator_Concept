@echo off
REM Change to the script's directory
cd /d "%~dp0"

echo ========================================
echo Mathcad Automator - Demo
echo ========================================
echo.

REM Check Python
python --version 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Please install Python 3.11 first.
    pause
    exit /b 1
)

REM Create virtual environment if missing
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM Install Python dependencies
echo Installing Python dependencies (this may take a few minutes)...
call venv\Scripts\pip.exe install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)
echo.

REM Validate prebuilt frontend assets exist (no npm required at runtime)
if not exist "frontend\dist\index.html" (
    echo ERROR: Missing frontend\dist\index.html
    echo This release is intended to run without npm and requires prebuilt frontend assets.
    pause
    exit /b 1
)

REM ========================================
echo Starting Mathcad Automator...
echo.
echo URL: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start backend server
call venv\Scripts\python.exe -m src.server.main
pause
