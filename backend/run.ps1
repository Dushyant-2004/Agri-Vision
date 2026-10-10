$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendRoot
& "C:\Users\Dushy\AppData\Local\Programs\Python\Python310\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
