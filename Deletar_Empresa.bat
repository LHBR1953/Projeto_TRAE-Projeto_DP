@echo off
set /p empresa="Digite o ID da empresa que deseja deletar (ex: emp_gemini): "

set SUPABASE_URL=https://trcktinwjpvcikidrryn.supabase.co
set SUPABASE_ANON_KEY=sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA
set SUPERADMIN_EMAIL=lhbr@lhbr.com.br
set SUPERADMIN_PASSWORD=123456
set EMPRESA_ID=%empresa%

echo .
echo [ATENCAO] Iniciando limpeza da empresa: %EMPRESA_ID%...
echo .