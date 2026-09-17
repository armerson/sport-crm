create index finance_transactions_player_idx
  on public.finance_transactions (player_id)
  where player_id is not null;

create index finance_transactions_product_idx
  on public.finance_transactions (product_id)
  where product_id is not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'finance_transactions_guest_registration_id_fkey'
      and conrelid = 'public.finance_transactions'::regclass
  ) then
    create index finance_transactions_guest_registration_idx
      on public.finance_transactions (guest_registration_id)
      where guest_registration_id is not null;
  end if;
end $$;
