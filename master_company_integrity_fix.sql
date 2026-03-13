DO $$ 
BEGIN 
    ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_empresa_id_fkey;
    ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.profissionais DROP CONSTRAINT IF EXISTS profissionais_empresa_id_fkey;
    ALTER TABLE public.profissionais ADD CONSTRAINT profissionais_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.especialidades DROP CONSTRAINT IF EXISTS especialidades_empresa_id_fkey;
    ALTER TABLE public.especialidades ADD CONSTRAINT especialidades_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_empresa_id_fkey;
    ALTER TABLE public.servicos ADD CONSTRAINT servicos_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_empresa_id_fkey;
    ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_empresa_id_fkey;
    ALTER TABLE public.orcamento_itens ADD CONSTRAINT orcamento_itens_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_empresa_id_fkey;
    ALTER TABLE public.orcamento_pagamentos ADD CONSTRAINT orcamento_pagamentos_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_empresa_id_fkey;
    ALTER TABLE public.financeiro_transacoes ADD CONSTRAINT financeiro_transacoes_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_empresa_id_fkey;
    ALTER TABLE public.financeiro_comissoes ADD CONSTRAINT financeiro_comissoes_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

    ALTER TABLE public.usuario_empresas DROP CONSTRAINT IF EXISTS usuario_empresas_empresa_id_fkey;
    ALTER TABLE public.usuario_empresas ADD CONSTRAINT usuario_empresas_empresa_id_fkey 
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;
END $$;
