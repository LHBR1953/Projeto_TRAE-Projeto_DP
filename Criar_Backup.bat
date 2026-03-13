@echo off
setlocal enabledelayedexpansion
:: Configura nomes de pastas
set "SRC=%~dp0"
:: Remove a barra invertida final para evitar erro com aspas no robocopy
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

set "BACK_BASE=%~dp0..\Backups_OdontoClinic"
if "%BACK_BASE:~-1%"=="\" set "BACK_BASE=%BACK_BASE:~0,-1%"

echo Verificando data e hora...
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do (
    set "dt=%%I"
    set "datetime=!dt:~0,14!"
)
set "timestamp=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%h%datetime:~10,2%m"

set "DEST_DIR=%BACK_BASE%\Backup_%timestamp%"

echo ======================================================
echo    BACKUP AUTOMATICO - ODONTOCLINIC
echo ======================================================
echo Origem:  "%SRC%"
echo Destino: "%DEST_DIR%"
echo.

if not exist "%BACK_BASE%" mkdir "%BACK_BASE%"

echo Criando backup, aguarde...
:: /E: copia subdiretorios, incluindo vazios
:: /XD: exclui diretorios
:: /R:1 /W:1: tenta 1 vez e espera 1 segundo em caso de erro
robocopy "%SRC%" "%DEST_DIR%" /E /XD .git node_modules /R:1 /W:1 /V /NP

echo.
if %ERRORLEVEL% LEQ 8 (
    echo [SUCESSO] Backup concluido!
    echo Local: "%DEST_DIR%"
) else (
    echo [ERRO] Falha no backup. Codigo: %ERRORLEVEL%
)

echo ======================================================
pause
