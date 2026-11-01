$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendRoot

$pythonCandidates = @(
    (Join-Path (Split-Path -Parent $backendRoot) ".venv\Scripts\python.exe"),
    (Join-Path $backendRoot ".venv\Scripts\python.exe")
)

$pythonPath = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $pythonPath) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        $pythonPath = $pythonCommand.Source
    }
}

if (-not $pythonPath) {
    throw "Python was not found. Create the repository virtual environment or install Python 3.10+."
}

& $pythonPath -c "import pypdf" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "The selected Python environment is missing pypdf. Install backend requirements with: $pythonPath -m pip install -r requirements.txt"
}

& $pythonPath -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
