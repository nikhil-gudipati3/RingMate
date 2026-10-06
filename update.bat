@echo off
REM RingMate updater - run this after extracting a new ringmate zip OVER the
REM old folder. It reuses the existing .venv, so pip only downloads what is
REM actually missing (usually nothing) instead of everything again.
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo No virtual environment found - creating one...
    python -m venv .venv
    if errorlevel 1 (
        echo Could not create the virtual environment.
        echo Install Python from python.org and tick "Add python to PATH".
        pause
        exit /b 1
    )
)

echo Checking requirements - only missing packages will download...
.venv\Scripts\python -m pip install -r requirements.txt
if errorlevel 1 (
    echo Something failed during install. Check the messages above.
    pause
    exit /b 1
)

echo.
echo Done. Start the server in one window, the laptop agent in another:
echo   .venv\Scripts\python -m uvicorn server.main:app --port 8000
echo   .venv\Scripts\python laptop_agent/agent.py laptop_agent/agent_config.json
pause
