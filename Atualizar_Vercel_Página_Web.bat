@echo off
cls
title DEPLOY OCC - VERCEL TURBO
echo.
echo ==========================================
echo    INICIANDO DEPLOY DO OCC NA VERCEL
echo ==========================================
echo.

cd /d C:\Projeto_TRAE\Projeto_DP

:: Passo 1: Login (Caso a sessao tenha expirado)
echo [1/3] Verificando autenticacao...
call vercel login --confirm

:: Passo 2: Deploy de Producao (Forca a atualizacao do index.html e assets)
echo [2/3] Enviando arquivos para producao...
echo (Isso pode levar alguns segundos dependendo do tamanho do video)
call vercel --prod --yes

:: Passo 3: Finalizacao
echo.
echo [3/3] DEPLOY CONCLUIDO COM SUCESSO!
echo.
echo Seu site esta no ar em: https://projeto-trae-projeto-dp.vercel.app/
echo.
echo ==========================================
pause