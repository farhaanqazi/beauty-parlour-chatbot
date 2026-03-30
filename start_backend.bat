@echo off
REM Start FastAPI backend with correct SSL configuration
set SSL_CERT_FILE=f:\beauty_parlour_chatbot\venv\Lib\site-packages\certifi\cacert.pem
cd /d f:\beauty_parlour_chatbot\Beauty_Parlour_chatbot-
f:\beauty_parlour_chatbot\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
