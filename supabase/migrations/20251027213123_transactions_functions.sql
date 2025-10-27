-- Create helper: recompute balances for a single account
create or replace function public.fn_transaction_recompute(p_account_id bigint)
returns void
language sql
security definer
as $$
  update transaction t
  set balance = s.running
  from (
    select id,
           sum(amount) over (
             partition by account_id
             order by transaction_date_time, id
             rows between unbounded preceding and current row
           ) as running
    from transaction
    where account_id = p_account_id
  ) s
  where t.id = s.id;
$$;

-- Create and recompute
create or replace function public.fn_transaction_create_and_recompute(
  p_account_id bigint,
  p_created_by uuid,
  p_title text,
  p_description text,
  p_amount numeric,
  p_transaction_date_time timestamptz
)
returns transaction
language plpgsql
security definer
as $$
declare
  v_row transaction;
begin
  insert into transaction(account_id, created_by, title, description, amount, transaction_date_time, balance)
  values (p_account_id, p_created_by, p_title, p_description, p_amount, p_transaction_date_time, 0)
  returning * into v_row;

  perform public.fn_transaction_recompute(p_account_id);

  select * into v_row from transaction where id = v_row.id;
  return v_row;
end;
$$;

-- Update and recompute
create or replace function public.fn_transaction_update_and_recompute(
  p_account_id bigint,
  p_tx_id bigint,
  p_title text,
  p_description text,
  p_amount numeric,
  p_transaction_date_time timestamptz,
  p_description_is_set boolean default false
)
returns transaction
language plpgsql
security definer
as $$
declare
  v_row transaction;
begin
  update transaction
  set title = coalesce(p_title, title),
      description = case when p_description_is_set then p_description else description end,
      amount = coalesce(p_amount, amount),
      transaction_date_time = coalesce(p_transaction_date_time, transaction_date_time)
  where id = p_tx_id and account_id = p_account_id
  returning * into v_row;

  if not found then
    raise exception 'Transaction not found';
  end if;

  perform public.fn_transaction_recompute(p_account_id);

  select * into v_row from transaction where id = v_row.id;
  return v_row;
end;
$$;

-- Delete and recompute
create or replace function public.fn_transaction_delete_and_recompute(
  p_account_id bigint,
  p_tx_id bigint
)
returns void
language plpgsql
security definer
as $$
begin
  delete from transaction where id = p_tx_id and account_id = p_account_id;
  perform public.fn_transaction_recompute(p_account_id);
end;
$$;


