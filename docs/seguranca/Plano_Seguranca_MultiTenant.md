# Plano seguro — Multi-tenant (RLS + Auditoria + Export por empresa)

## Objetivo
Endurecer isolamento entre empresas sem quebrar o OCC:
- RLS padronizada com `empresa_id`
- Auditoria de ações sensíveis (quem fez, quando, em qual empresa)
- Export/backup por empresa (lógico)

## Ponto de recuperação (obrigatório antes de aplicar)
1) Rodar no Supabase SQL Editor:
- [20260318_security_snapshot.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_snapshot.sql)

2) Salvar o resultado do snapshot em um arquivo local (copiar/colar).

3) Se algo der errado, rollback rápido:
- RLS rollback: [20260318_security_rls_hardening_rollback.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_rls_hardening_rollback.sql)
- Auditoria rollback: [20260318_security_audit_rollback.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_audit_rollback.sql)

## Execução segura (ordem recomendada)
### 1) Diagnóstico (read-only)
Rodar:
- [20260318_security_diagnostico.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_diagnostico.sql)

O que precisa estar “ok” antes de endurecer:
- `empresa_id_null = 0` em tabelas críticas
- todas as tabelas do app existem e têm `empresa_id` (exceto `empresas`)

### 2) Aplicar hardening de RLS (incremental)
Rodar:
- [20260318_security_rls_hardening_apply.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_rls_hardening_apply.sql)

O que esse script faz:
- garante helpers (`is_member_of_empresa`, `is_admin_of_empresa`) e um parser de permissão (`occ_has_perm`)
- habilita RLS nas tabelas principais do OCC (quando existirem)
- cria policies `occ_v1_*` por tabela, evitando sobrescrever policies existentes

### 3) Aplicar auditoria (opcional, mas recomendado)
Rodar:
- [20260318_security_audit_apply.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_audit_apply.sql)

O que esse script faz:
- cria `public.occ_audit_log`
- cria triggers `occ_audit_trg` em tabelas sensíveis (se existirem)

## Export/backup por empresa (procedimento)
Script:
- [export_empresa_backup.js](file:///c:/Projeto_TRAE/projeto_dp/scripts/export_empresa_backup.js)

Execução (fora do navegador), com Service Role:
```bash
set SUPABASE_URL=...
set SUPABASE_SERVICE_ROLE_KEY=...
set EMPRESA_ID=emp_dp
node scripts/export_empresa_backup.js
```

Resultado:
- cria uma pasta `backup_empresa/` com JSON por tabela e um `_meta.json`.

## Reversão (se algo “quebrar”)
Ordem recomendada:
1) Rodar rollback de auditoria:
- [20260318_security_audit_rollback.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_audit_rollback.sql)

2) Rodar rollback de RLS hardening:
- [20260318_security_rls_hardening_rollback.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_rls_hardening_rollback.sql)

3) Rodar novamente o snapshot para confirmar estado:
- [20260318_security_snapshot.sql](file:///c:/Projeto_TRAE/projeto_dp/sql/20260318_security_snapshot.sql)

