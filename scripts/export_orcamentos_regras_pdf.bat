@echo off
setlocal enabledelayedexpansion

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

set "IN_HTML=%ROOT%\docs\arquitetura\Orcamentos_Regras_e_Fluxos.html"
set "OUT_PDF=%ROOT%\docs\arquitetura\Orcamentos_Regras_e_Fluxos.pdf"

if not exist "%IN_HTML%" (
  echo ERRO: Nao encontrei o arquivo HTML:
  echo   %IN_HTML%
  exit /b 1
)

set "EDGE1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

set "EDGE="
if exist "%EDGE1%" set "EDGE=%EDGE1%"
if not defined EDGE if exist "%EDGE2%" set "EDGE=%EDGE2%"

if not defined EDGE (
  echo ERRO: Microsoft Edge nao encontrado.
  echo Abra o HTML e use Imprimir ^> Salvar como PDF:
  echo   %IN_HTML%
  exit /b 2
)

echo Gerando PDF...
"%EDGE%" --headless --disable-gpu --no-first-run --print-to-pdf="%OUT_PDF%" "%IN_HTML%"

if exist "%OUT_PDF%" (
  echo OK: %OUT_PDF%
  exit /b 0
)

echo ERRO: falha ao gerar PDF.
exit /b 3

