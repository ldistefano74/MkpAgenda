# Corre los tests de backend (Django/DRF).
#
# Uso:
#   .\scripts\run_tests.ps1                                   # toda la suite
#   .\scripts\run_tests.ps1 API.tests.test_precios            # un archivo
#   .\scripts\run_tests.ps1 API.tests.test_precios.GetPrecioServicioTests   # una clase
#
# La base la elige settings.py: al detectar `test` en argv usa TEST_DATABASE_URL
# (Postgres local). Django crea y destruye `test_MkpAgenda`; nunca toca Neon.

param(
    [string]$Target = "API.tests"
)

# Los scripts viven en scripts/, asi que la raiz del repo es el directorio padre.
# Se deriva de $PSScriptRoot y no del directorio actual: el script anda igual
# invocado como .\scripts\<script> desde la raiz o desde cualquier otra parte.
$RepoRoot = Split-Path $PSScriptRoot -Parent

$venvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Error "No se encontró el venv en $venvPython"
    exit 1
}

Push-Location $RepoRoot
try {
    # --- Preflight: el servidor de Postgres tiene que estar escuchando --------
    # Host y puerto salen de TEST_DATABASE_URL (env var, o .env como fallback)
    # para que el chequeo siga a la config si algún día cambia.
    $testDbUrl = $env:TEST_DATABASE_URL
    if (-not $testDbUrl) {
        $envFile = Join-Path $RepoRoot ".env"
        $linea = Select-String -Path $envFile -Pattern '^\s*TEST_DATABASE_URL\s*=\s*(.+)$' -ErrorAction SilentlyContinue
        if (-not $linea) {
            Write-Error "No se encontró TEST_DATABASE_URL ni en el entorno ni en $envFile"
            exit 1
        }
        $testDbUrl = $linea.Matches[0].Groups[1].Value.Trim()
    }

    $uri = [uri]$testDbUrl
    $dbHost = $uri.Host
    $dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

    if (-not (Test-NetConnection -ComputerName $dbHost -Port $dbPort -InformationLevel Quiet -WarningAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "PostgreSQL NO está respondiendo en ${dbHost}:${dbPort}." -ForegroundColor Red
        Write-Host "Los tests necesitan ese servidor para crear la base test_*." -ForegroundColor Yellow
        Write-Host "Revisá que el servicio esté corriendo, o TEST_DATABASE_URL en .env." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "PostgreSQL OK en ${dbHost}:${dbPort}" -ForegroundColor DarkGray
    Write-Host "Corriendo tests: $Target" -ForegroundColor Cyan

    & $venvPython manage.py test $Target --noinput --failfast
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "Tests fallidos (exit code $exitCode)." -ForegroundColor Red
    } else {
        Write-Host ""
        Write-Host "Tests OK." -ForegroundColor Green
    }

    exit $exitCode
}
finally {
    Pop-Location
}
