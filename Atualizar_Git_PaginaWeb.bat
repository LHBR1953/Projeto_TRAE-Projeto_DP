@echo off

cd /d C:\Projeto_TRAE\Projeto_DP

git status
git add .

for /f %%i in ('powershell -command "Get-Date -Format yyyyMMdd-HHmm"') do set DATA=%%i

git commit -m "Atualiza menu mobile (build %DATA%)"

git push