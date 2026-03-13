ALTER TABLE public.financeiro_comissoes
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.financeiro_comissoes
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id);

ALTER TABLE public.financeiro_comissoes
  ADD COLUMN IF NOT EXISTS estornado_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.financeiro_comissoes
  ADD COLUMN IF NOT EXISTS estornado_por UUID REFERENCES auth.users(id);

ALTER TABLE public.financeiro_comissoes
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_fin_comissoes_transfer_group_id
  ON public.financeiro_comissoes(transfer_group_id);

