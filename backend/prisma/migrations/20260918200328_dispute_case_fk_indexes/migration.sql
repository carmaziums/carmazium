CREATE INDEX IF NOT EXISTS "dispute_cases_openedById_idx"
  ON public.dispute_cases ("openedById");

CREATE INDEX IF NOT EXISTS "dispute_cases_resolvedById_idx"
  ON public.dispute_cases ("resolvedById");
