BEGIN;

-- 1. SANEAMENTO INVISÍVEL: TABELA orcamento_pagamentos
DO $$
BEGIN
    -- Verifica se a coluna orcamento_id é numérica (bigint, integer) ou varchar
    -- Vamos garantir a transição limpa convertendo cruzado com a tabela orcamentos
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orcamento_pagamentos' 
        AND column_name = 'orcamento_id'
        AND data_type IN ('bigint', 'integer', 'numeric', 'character varying', 'text')
    ) THEN
        
        -- Apenas adiciona coluna UUID temporária se ela não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'orcamento_pagamentos' AND column_name = 'orcamento_uuid'
        ) THEN
            ALTER TABLE public.orcamento_pagamentos ADD COLUMN orcamento_uuid UUID;
        END IF;

        -- Atualiza cruzando dados
        -- Cobre os casos onde orcamento_id guardava o seqid
        UPDATE public.orcamento_pagamentos p
        SET orcamento_uuid = o.id
        FROM public.orcamentos o
        WHERE p.orcamento_id::text = o.seqid::text
          AND p.empresa_id = o.empresa_id
          AND p.orcamento_uuid IS NULL;

        -- Fallback: Cobre casos onde já era um UUID válido (salvo como texto)
        UPDATE public.orcamento_pagamentos
        SET orcamento_uuid = orcamento_id::uuid
        WHERE orcamento_uuid IS NULL
          AND length(orcamento_id::text) = 36
          AND orcamento_id::text LIKE '%-%-%-%-%';

        -- Remove FKs antigas se existirem
        ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_orcamento_id_fkey;

        -- Troca as colunas
        ALTER TABLE public.orcamento_pagamentos DROP COLUMN orcamento_id;
        ALTER TABLE public.orcamento_pagamentos RENAME COLUMN orcamento_uuid TO orcamento_id;

        -- Restaura FK (agora para orcamentos.id)
        ALTER TABLE public.orcamento_pagamentos
        ADD CONSTRAINT orcamento_pagamentos_orcamento_id_fkey
        FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE RESTRICT;

    END IF;
END $$;


-- 2. SANEAMENTO INVISÍVEL: TABELA orcamento_itens
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orcamento_itens' 
        AND column_name = 'orcamento_id'
        AND data_type IN ('bigint', 'integer', 'numeric', 'character varying', 'text')
    ) THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'orcamento_itens' AND column_name = 'orcamento_uuid'
        ) THEN
            ALTER TABLE public.orcamento_itens ADD COLUMN orcamento_uuid UUID;
        END IF;

        -- Migra quem usava seqid
        UPDATE public.orcamento_itens i
        SET orcamento_uuid = o.id
        FROM public.orcamentos o
        WHERE i.orcamento_id::text = o.seqid::text
          AND i.empresa_id = o.empresa_id
          AND i.orcamento_uuid IS NULL;

        -- Migra quem já usava UUID
        UPDATE public.orcamento_itens
        SET orcamento_uuid = orcamento_id::uuid
        WHERE orcamento_uuid IS NULL
          AND length(orcamento_id::text) = 36
          AND orcamento_id::text LIKE '%-%-%-%-%';

        ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_orcamento_id_fkey;
        
        ALTER TABLE public.orcamento_itens DROP COLUMN orcamento_id;
        ALTER TABLE public.orcamento_itens RENAME COLUMN orcamento_uuid TO orcamento_id;

        ALTER TABLE public.orcamento_itens
        ADD CONSTRAINT orcamento_itens_orcamento_id_fkey
        FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE RESTRICT;

    END IF;
END $$;


-- 3. SANEAMENTO INVISÍVEL: TABELA financeiro_transacoes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'financeiro_transacoes' 
        AND column_name = 'orcamento_id'
        AND data_type IN ('bigint', 'integer', 'numeric', 'character varying', 'text')
    ) THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'financeiro_transacoes' AND column_name = 'orcamento_uuid'
        ) THEN
            ALTER TABLE public.financeiro_transacoes ADD COLUMN orcamento_uuid UUID;
        END IF;

        UPDATE public.financeiro_transacoes f
        SET orcamento_uuid = o.id
        FROM public.orcamentos o
        WHERE f.orcamento_id::text = o.seqid::text
          AND f.empresa_id = o.empresa_id
          AND f.orcamento_uuid IS NULL;

        UPDATE public.financeiro_transacoes
        SET orcamento_uuid = orcamento_id::uuid
        WHERE orcamento_uuid IS NULL
          AND length(orcamento_id::text) = 36
          AND orcamento_id::text LIKE '%-%-%-%-%';

        ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_orcamento_id_fkey;

        ALTER TABLE public.financeiro_transacoes DROP COLUMN orcamento_id;
        ALTER TABLE public.financeiro_transacoes RENAME COLUMN orcamento_uuid TO orcamento_id;

        -- Referência UUID final
        ALTER TABLE public.financeiro_transacoes
        ADD CONSTRAINT financeiro_transacoes_orcamento_id_fkey
        FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE RESTRICT;

    END IF;
END $$;

COMMIT;