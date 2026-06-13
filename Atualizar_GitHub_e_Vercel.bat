@echo off
:: Altera a codificação do prompt para UTF-8 (evita quebrar acentos na tela)
chcp 65001 > nul

echo ============================================================
echo   🚀 [OCC] INICIANDO PROCESSO DE ATUALIZAÇÃO GLOBAL 
echo ============================================================
echo.

:: --------------------------------------------------------------
:: PASSO 1: ATUALIZAÇÃO DO GITHUB (BACKUP SEGURO)
:: --------------------------------------------------------------
echo 📦 [PASSO 1/2] Salvando alterações no GitHub...
echo ⚡ Executando comandos do Git...
echo.

git add .
git commit -m "Atualização automática OCC: Código e Produção Vercel"
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo ❌ [ALERTA] Ocorreu um problema ao enviar para o GitHub!
    echo 🤔 Verifique sua conexão ou se há conflitos.
    echo 🕒 Tentando prosseguir para a deploy na Vercel mesmo assim...
    echo.
) else (
    echo.
    echo  ✔️  GitHub atualizado com sucesso!
    echo.
)

echo ------------------------------------------------------------

:: --------------------------------------------------------------
:: PASSO 2: DEPLOY NA VERCEL (LANDING PAGE PROD)
:: --------------------------------------------------------------
echo 🚀 [PASSO 2/2] Enviando produção direta para a Vercel...
echo ⚡ Executando Vercel CLI em modo Produção...
echo.

call vercel --prod

if %errorlevel% neq 0 (
    echo.
    echo ❌ [ERRO CRÍTICO] A deploy na Vercel falhou!
    echo 🛑 O site antigo CONTINUA NO AR. Verifique os logs acima.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo ============================================================
echo   🎉 [SUCESSO] SISTEMA OCC TOTALMENTE ATUALIZADO!
echo   🐙 Código salvo no GitHub  ^|  🌐 Site atualizado na Vercel
echo ============================================================
echo.
pause