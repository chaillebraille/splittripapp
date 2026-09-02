UPDATE public.expense_splits s
SET amount = round(s.amount / e.exchange_rate, 2)
FROM public.expenses e
WHERE e.id = s.expense_id AND e.exchange_rate <> 1;

ALTER TABLE public.expenses DROP COLUMN settle_amount;
ALTER TABLE public.expenses DROP COLUMN amount;