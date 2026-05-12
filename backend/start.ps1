param(
  [switch]$Reload
)

$ErrorActionPreference = "Stop"

$BackendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $BackendRoot

$PythonPath = Join-Path $BackendRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) {
  py -m venv .venv
}

& $PythonPath -m pip show uvicorn *> $null
if ($LASTEXITCODE -ne 0) {
  & $PythonPath -m pip install -r requirements-dev.txt
}

$UvicornArgs = @("healthintel_api.main:app", "--port", "8000")
if ($Reload) {
  $UvicornArgs += "--reload"
}

& $PythonPath -m uvicorn @UvicornArgs
