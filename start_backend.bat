@echo off
REM =============================================
REM Beauty Parlour Chatbot - Backend Starter
REM Works with new folder structure: backend/
REM =============================================

echo =============================================
echo    Starting Beauty Parlour Backend...
echo =============================================

:: Activate virtual environment
if exist "F:\beauty_parlour_chatbot\backend\venv\Scripts\activate.bat" (
    call "F:\beauty_parlour_chatbot\backend\venv\Scripts\activate.bat"
    echo [OK] Backend venv activated.
) else if exist "F:\beauty_parlour_chatbot\venv\Scripts\activate.bat" (
    call "F:\beauty_parlour_chatbot\venv\Scripts\activate.bat"
    echo [OK] Parent venv activated.
) else (
    echo [WARN] No venv found. Using system Python.
)

:: ALWAYS run from the backend folder so Python can find the 'app' package
cd /d "F:\beauty_parlour_chatbot\backend"

:: Set SSL certificate path (if needed)
set SSL_CERT_FILE=F:\beauty_parlour_chatbot\venv\Lib\site-packages\certifi\cacert.pem

echo [->] Starting FastAPI server...
echo     Press Ctrl + C to stop the server.
echo.

:: Try run_api.py first
python -m app.run_api

:: Fallback to uvicorn directly if run_api fails
if errorlevel 1 (
    echo.
    echo Falling back to uvicorn...
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)

pause