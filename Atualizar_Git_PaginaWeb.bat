@echo off

echocd /d C:\Projeto_TRAE\Projeto_DP

echogit status
echogit add .

echofor /f %%i in ('powershell -command "Get-Date -Format yyyyMMdd-HHmm"') do set DATA=%%i

echogit commit -m "Atualiza menu mobile (build %DATA%)"

echogit push

echo ---------------------------------------------------------

@echo off
cls
echo [INICIANDO DEPLOY DO OCC...]
cd /d C:\Projeto_TRAE\Projeto_DP

:: Garante que o Git adicione TUDO, inclusive arquivos novos (untracked)
git add -A

:: Pega a data e hora para o Build
for /f %%i in ('powershell -command "Get-Date -Format yyyyMMdd-HHmm"') do set DATA=%%i

echo [COMITANDO ALTERACOES: build %DATA%...]
:: O commit agora vai mencionar que estamos subindo a Landing Page e correcoes
git commit -m "Nova Landing Page Premium e correcoes de sistema (build %DATA%)"

echo [SUBINDO PARA O GITHUB...]
git push

echo.
echo [DEPLOY CONCLUIDO COM SUCESSO!]
pause