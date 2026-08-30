ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.expenses DROP COLUMN settle_amount;

UPDATE public.expenses SET exchange_rate = 1 / exchange_rate WHERE exchange_rate <> 0;

ALTER TABLE public.expenses
  ADD COLUMN settle_amount numeric GENERATED ALWAYS AS (amount * exchange_rate) STORED;