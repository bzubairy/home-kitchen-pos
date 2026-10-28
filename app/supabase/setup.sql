-- Home Kitchen POS: database setup.
-- Run this once in a new Supabase project: SQL Editor → New query → paste → Run.
-- Then optionally run demo-data.sql. See README.md for the full setup guide.
--
-- Sections build on each other in order; later sections replace some functions from
-- earlier ones with fuller versions.


-- ══════════════════════════════════════════════════════════════════════
-- 1. Menu items, ingredients and recipes
-- ══════════════════════════════════════════════════════════════════════

-- Ingredients (packaging is tracked as an ingredient too).
-- Quantities and costs use the base unit: g, ml or pcs.
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null check (unit in ('g', 'ml', 'pcs')),
  current_stock numeric not null default 0,
  low_stock_threshold numeric not null default 0 check (low_stock_threshold >= 0),
  cost_per_unit numeric not null default 0 check (cost_per_unit >= 0),
  is_packaging boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  price numeric(12, 2) not null check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- How much of each ingredient one unit of a menu item uses.
create table public.recipe_lines (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  primary key (menu_item_id, ingredient_id)
);

-- Recipe cost and margin per menu item, from current ingredient costs.
create view public.menu_item_costs
with (security_invoker = true) as
select
  m.id as menu_item_id,
  coalesce(sum(r.quantity * i.cost_per_unit), 0) as recipe_cost,
  m.price - coalesce(sum(r.quantity * i.cost_per_unit), 0) as margin
from public.menu_items m
left join public.recipe_lines r on r.menu_item_id = m.id
left join public.ingredients i on i.id = r.ingredient_id
group by m.id;

-- Saves a menu item and replaces its recipe in one transaction.
-- item: {id?, name, category, price, is_active}; lines: [{ingredient_id, quantity}]
create function public.save_menu_item(item jsonb, lines jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_id uuid := nullif(item ->> 'id', '')::uuid;
begin
  if item_id is null then
    insert into public.menu_items (name, category, price, is_active)
    values (item ->> 'name', item ->> 'category', (item ->> 'price')::numeric,
            coalesce((item ->> 'is_active')::boolean, true))
    returning id into item_id;
  else
    update public.menu_items
    set name = item ->> 'name',
        category = item ->> 'category',
        price = (item ->> 'price')::numeric,
        is_active = coalesce((item ->> 'is_active')::boolean, true)
    where id = item_id;
  end if;

  delete from public.recipe_lines where menu_item_id = item_id;

  insert into public.recipe_lines (menu_item_id, ingredient_id, quantity)
  select item_id, (l ->> 'ingredient_id')::uuid, (l ->> 'quantity')::numeric
  from jsonb_array_elements(lines) as l;

  return item_id;
end;
$$;

-- Security: only signed-in users (sign-ups are disabled) can read or change data.
alter table public.ingredients enable row level security;
alter table public.menu_items enable row level security;
alter table public.recipe_lines enable row level security;

create policy "Signed-in users have full access" on public.ingredients
  for all to authenticated using (true) with check (true);
create policy "Signed-in users have full access" on public.menu_items
  for all to authenticated using (true) with check (true);
create policy "Signed-in users have full access" on public.recipe_lines
  for all to authenticated using (true) with check (true);

revoke all on public.ingredients, public.menu_items, public.recipe_lines, public.menu_item_costs from anon;
grant select, insert, update, delete on public.ingredients, public.menu_items, public.recipe_lines to authenticated;
grant select on public.menu_item_costs to authenticated;
revoke execute on function public.save_menu_item(jsonb, jsonb) from public, anon;
grant execute on function public.save_menu_item(jsonb, jsonb) to authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- 2. Customers, orders, settings and Foodpanda pricing
-- ══════════════════════════════════════════════════════════════════════

-- Shared items such as bags: e.g. a bag that holds 2 items uses 0.5 per item in recipes,
-- and each order's total is rounded up.
alter table public.ingredients
  add column round_up_per_order boolean not null default false;

-- Foodpanda has its own (higher) prices. Null means "same as normal price".
alter table public.menu_items
  add column foodpanda_price numeric(12, 2) check (foodpanda_price >= 0);

-- save_menu_item now also saves the Foodpanda price.
create or replace function public.save_menu_item(item jsonb, lines jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_id uuid := nullif(item ->> 'id', '')::uuid;
begin
  if item_id is null then
    insert into public.menu_items (name, category, price, foodpanda_price, is_active)
    values (item ->> 'name', item ->> 'category', (item ->> 'price')::numeric,
            nullif(item ->> 'foodpanda_price', '')::numeric,
            coalesce((item ->> 'is_active')::boolean, true))
    returning id into item_id;
  else
    update public.menu_items
    set name = item ->> 'name',
        category = item ->> 'category',
        price = (item ->> 'price')::numeric,
        foodpanda_price = nullif(item ->> 'foodpanda_price', '')::numeric,
        is_active = coalesce((item ->> 'is_active')::boolean, true)
    where id = item_id;
  end if;

  delete from public.recipe_lines where menu_item_id = item_id;

  insert into public.recipe_lines (menu_item_id, ingredient_id, quantity)
  select item_id, (l ->> 'ingredient_id')::uuid, (l ->> 'quantity')::numeric
  from jsonb_array_elements(lines) as l;

  return item_id;
end;
$$;

-- App-wide settings (a single row).
create table public.settings (
  id boolean primary key default true check (id),
  foodpanda_commission_rate numeric not null default 0.32
    check (foodpanda_commission_rate >= 0 and foodpanda_commission_rate < 1),
  -- IANA time zone used for "today", opening hours and reports. Keep in sync with brand.json.
  time_zone text not null default 'Asia/Karachi'
);
insert into public.settings default values;

create function public.app_time_zone()
returns text
language sql
stable
set search_path = ''
as $$
  select time_zone from public.settings;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  notes text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  customer_id uuid references public.customers (id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'phone', 'instagram', 'foodpanda')),
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'delivered', 'cancelled')),
  delivery_at timestamptz not null,
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  -- Saved when the order is created, so later rate changes don't affect it.
  commission_rate numeric not null default 0,
  payment_method text check (payment_method in ('cash', 'bank_transfer', 'foodpanda')),
  delivered_at timestamptz,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint delivered_orders_are_paid check (status <> 'delivered' or payment_method is not null)
);

create index orders_delivery_at_idx on public.orders (delivery_at);

create table public.order_items (
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  -- Price at the time of the order (Foodpanda price for Foodpanda orders).
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  primary key (order_id, menu_item_id)
);

-- Creates or edits an order (edits only while pending), all in one transaction.
-- payload: {id?, customer_id?, new_customer?: {name, phone?}, channel, delivery_at, discount?, notes?}
-- items:   [{menu_item_id, quantity}]
create function public.save_order(payload jsonb, items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_customer_id uuid := nullif(payload ->> 'customer_id', '')::uuid;
  v_channel text := payload ->> 'channel';
  v_rate numeric := 0;
begin
  if jsonb_array_length(coalesce(items, '[]'::jsonb)) = 0 then
    raise exception 'An order needs at least one item';
  end if;

  if payload -> 'new_customer' ->> 'name' is not null then
    insert into public.customers (name, phone)
    values (trim(payload -> 'new_customer' ->> 'name'),
            nullif(trim(payload -> 'new_customer' ->> 'phone'), ''))
    returning id into v_customer_id;
  end if;

  if v_channel = 'foodpanda' then
    select foodpanda_commission_rate into v_rate from public.settings;
  end if;

  if v_order_id is null then
    insert into public.orders (customer_id, channel, delivery_at, discount, commission_rate, notes)
    values (v_customer_id, v_channel, (payload ->> 'delivery_at')::timestamptz,
            coalesce((payload ->> 'discount')::numeric, 0), v_rate, payload ->> 'notes')
    returning id into v_order_id;
  else
    update public.orders
    set customer_id = v_customer_id,
        channel = v_channel,
        delivery_at = (payload ->> 'delivery_at')::timestamptz,
        discount = coalesce((payload ->> 'discount')::numeric, 0),
        commission_rate = v_rate,
        notes = payload ->> 'notes'
    where id = v_order_id and status = 'pending';
    if not found then
      raise exception 'Only pending orders can be edited';
    end if;
    delete from public.order_items where order_items.order_id = v_order_id;
  end if;

  -- Prices are taken from the menu here, not from the phone.
  insert into public.order_items (order_id, menu_item_id, quantity, unit_price)
  select v_order_id, m.id, (i ->> 'quantity')::integer,
         case when v_channel = 'foodpanda' then coalesce(m.foodpanda_price, m.price) else m.price end
  from jsonb_array_elements(items) as i
  join public.menu_items m on m.id = (i ->> 'menu_item_id')::uuid;

  return v_order_id;
end;
$$;

-- Moves an order to a new status. Delivered needs a payment method
-- (Foodpanda orders are always paid via Foodpanda).
create function public.set_order_status(p_order_id uuid, p_status text, p_payment_method text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel text;
begin
  select channel into v_channel from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_status = 'delivered' then
    if v_channel = 'foodpanda' then
      p_payment_method := 'foodpanda';
    elsif p_payment_method is null or p_payment_method = 'foodpanda' then
      raise exception 'Choose cash or bank transfer';
    end if;
    update public.orders
    set status = 'delivered', payment_method = p_payment_method, delivered_at = now()
    where id = p_order_id;
  else
    update public.orders
    set status = p_status, payment_method = null, delivered_at = null
    where id = p_order_id;
  end if;
end;
$$;

-- Security: same rule as before — signed-in users have full access.
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Signed-in users can read" on public.settings
  for select to authenticated using (true);
create policy "Signed-in users can update" on public.settings
  for update to authenticated using (true) with check (true);
create policy "Signed-in users have full access" on public.customers
  for all to authenticated using (true) with check (true);
create policy "Signed-in users have full access" on public.orders
  for all to authenticated using (true) with check (true);
create policy "Signed-in users have full access" on public.order_items
  for all to authenticated using (true) with check (true);

revoke all on public.settings, public.customers, public.orders, public.order_items from anon;
grant select, update on public.settings to authenticated;
grant select, insert, update, delete on public.customers, public.orders, public.order_items to authenticated;
revoke execute on function public.save_order(jsonb, jsonb) from public, anon;
revoke execute on function public.set_order_status(uuid, text, text) from public, anon;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- 3. Automatic stock, restocking and expenses
-- ══════════════════════════════════════════════════════════════════════

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null check (category in ('ingredients', 'packaging', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  -- Set when the expense came from restocking an ingredient (quantity in base units).
  ingredient_id uuid references public.ingredients (id) on delete set null,
  quantity numeric,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index expenses_date_idx on public.expenses (date);

-- Every change to an ingredient's stock, so current stock can always be explained.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  change numeric not null,
  reason text not null check (reason in ('order', 'order_undone', 'restock', 'adjustment')),
  order_id uuid references public.orders (id) on delete set null,
  expense_id uuid references public.expenses (id) on delete set null,
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_ingredient_idx on public.stock_movements (ingredient_id, created_at desc);

-- Ingredients one order uses. Shared items (bags) are rounded up per order.
create function public.order_ingredient_usage(p_order_id uuid)
returns table (ingredient_id uuid, quantity numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.ingredient_id,
         case when i.round_up_per_order then ceil(sum(oi.quantity * r.quantity))
              else sum(oi.quantity * r.quantity) end
  from public.order_items oi
  join public.recipe_lines r on r.menu_item_id = oi.menu_item_id
  join public.ingredients i on i.id = r.ingredient_id
  where oi.order_id = p_order_id
  group by r.ingredient_id, i.round_up_per_order;
$$;

-- How much of each ingredient the pending/preparing orders still need.
create view public.ingredient_demand
with (security_invoker = true) as
select u.ingredient_id, sum(u.quantity) as needed
from public.orders o
cross join lateral public.order_ingredient_usage(o.id) u
where o.status in ('pending', 'preparing')
group by u.ingredient_id;

-- Applies a stock change and records it in the history.
create function public.apply_stock_change(
  p_ingredient_id uuid, p_change numeric, p_reason text,
  p_order_id uuid default null, p_expense_id uuid default null, p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.ingredients set current_stock = current_stock + p_change where id = p_ingredient_id;
  insert into public.stock_movements (ingredient_id, change, reason, order_id, expense_id, note)
  values (p_ingredient_id, p_change, p_reason, p_order_id, p_expense_id, p_note);
end;
$$;

-- Order status now also moves stock: delivering deducts it, undoing a delivery restores it.
create or replace function public.set_order_status(p_order_id uuid, p_status text, p_payment_method text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel text;
  v_old_status text;
  u record;
begin
  select channel, status into v_channel, v_old_status
  from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_status = 'delivered' then
    if v_channel = 'foodpanda' then
      p_payment_method := 'foodpanda';
    elsif p_payment_method is null or p_payment_method = 'foodpanda' then
      raise exception 'Choose cash or bank transfer';
    end if;
    if v_old_status <> 'delivered' then
      for u in select * from public.order_ingredient_usage(p_order_id) loop
        perform public.apply_stock_change(u.ingredient_id, -u.quantity, 'order', p_order_id);
      end loop;
    end if;
    update public.orders
    set status = 'delivered', payment_method = p_payment_method, delivered_at = now()
    where id = p_order_id;
  else
    if v_old_status = 'delivered' then
      for u in select * from public.order_ingredient_usage(p_order_id) loop
        perform public.apply_stock_change(u.ingredient_id, u.quantity, 'order_undone', p_order_id);
      end loop;
    end if;
    update public.orders
    set status = p_status, payment_method = null, delivered_at = null
    where id = p_order_id;
  end if;
end;
$$;

-- Records a purchase: adds stock, updates the cost to the latest price, and creates the expense.
-- p_quantity is in base units (g, ml, pcs).
create function public.restock_ingredient(
  p_ingredient_id uuid, p_quantity numeric, p_total_cost numeric,
  p_date date default current_date, p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_packaging boolean;
  v_expense_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be more than 0';
  end if;
  if p_total_cost is null or p_total_cost <= 0 then
    raise exception 'Price paid must be more than 0';
  end if;

  select is_packaging into v_is_packaging from public.ingredients where id = p_ingredient_id;
  if not found then
    raise exception 'Ingredient not found';
  end if;

  insert into public.expenses (date, category, amount, ingredient_id, quantity, notes)
  values (coalesce(p_date, current_date),
          case when v_is_packaging then 'packaging' else 'ingredients' end,
          p_total_cost, p_ingredient_id, p_quantity, p_note)
  returning id into v_expense_id;

  update public.ingredients set cost_per_unit = p_total_cost / p_quantity where id = p_ingredient_id;
  perform public.apply_stock_change(p_ingredient_id, p_quantity, 'restock', null, v_expense_id, p_note);
  return v_expense_id;
end;
$$;

-- Corrects stock for wastage or a recount. Pass either a change or the new counted stock.
create function public.adjust_stock(
  p_ingredient_id uuid, p_change numeric default null, p_new_stock numeric default null, p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current numeric;
begin
  select current_stock into v_current from public.ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Ingredient not found';
  end if;
  if p_new_stock is not null then
    p_change := p_new_stock - v_current;
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'Nothing to change';
  end if;
  perform public.apply_stock_change(p_ingredient_id, p_change, 'adjustment', null, null, p_note);
end;
$$;

-- Deletes an expense. If it came from a restock, the stock that restock added is removed again.
create function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m record;
begin
  for m in select * from public.stock_movements where expense_id = p_expense_id and reason = 'restock' loop
    perform public.apply_stock_change(m.ingredient_id, -m.change, 'adjustment', null, null, 'Restock deleted');
  end loop;
  delete from public.expenses where id = p_expense_id;
end;
$$;

-- Stock entered when an ingredient is first created also goes in the history.
create function public.log_starting_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.current_stock <> 0 then
    insert into public.stock_movements (ingredient_id, change, reason, note)
    values (new.id, new.current_stock, 'adjustment', 'Starting stock');
  end if;
  return new;
end;
$$;

create trigger ingredients_log_starting_stock
after insert on public.ingredients
for each row execute function public.log_starting_stock();

-- Record the stock you've already entered as each ingredient's starting point.
insert into public.stock_movements (ingredient_id, change, reason, note)
select id, current_stock, 'adjustment', 'Starting stock'
from public.ingredients
where current_stock <> 0;

-- Security: signed-in users only. Stock history can be added to but never edited.
alter table public.expenses enable row level security;
alter table public.stock_movements enable row level security;

create policy "Signed-in users have full access" on public.expenses
  for all to authenticated using (true) with check (true);
create policy "Signed-in users can read" on public.stock_movements
  for select to authenticated using (true);
create policy "Signed-in users can add" on public.stock_movements
  for insert to authenticated with check (true);

revoke all on public.expenses, public.stock_movements, public.ingredient_demand from anon;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select on public.ingredient_demand to authenticated;

revoke execute on function public.order_ingredient_usage(uuid) from public, anon;
revoke execute on function public.apply_stock_change(uuid, numeric, text, uuid, uuid, text) from public, anon;
revoke execute on function public.restock_ingredient(uuid, numeric, numeric, date, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.delete_expense(uuid) from public, anon;
revoke execute on function public.log_starting_stock() from public, anon;
grant execute on function public.order_ingredient_usage(uuid) to authenticated;
grant execute on function public.apply_stock_change(uuid, numeric, text, uuid, uuid, text) to authenticated;
grant execute on function public.restock_ingredient(uuid, numeric, numeric, date, text) to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function public.log_starting_stock() to authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- 4. Reports
-- ══════════════════════════════════════════════════════════════════════

-- Summary for days p_from (inclusive) to p_to (exclusive), in the business's time zone.
-- Sales count delivered orders only, after discount. Expenses use their own date.
create function public.report_summary(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with delivered as (
    select o.id, o.channel, o.commission_rate,
           (o.delivery_at at time zone public.app_time_zone())::date as day,
           greatest(coalesce(sum(oi.quantity * oi.unit_price), 0) - o.discount, 0) as total
    from public.orders o
    left join public.order_items oi on oi.order_id = o.id
    where o.status = 'delivered'
      and o.delivery_at >= (p_from::timestamp at time zone public.app_time_zone())
      and o.delivery_at < (p_to::timestamp at time zone public.app_time_zone())
    group by o.id
  ),
  orders as (
    select *, total * commission_rate as commission from delivered
  ),
  expenses as (
    select category, amount from public.expenses where date >= p_from and date < p_to
  )
  select jsonb_build_object(
    'orders', (select count(*) from orders),
    'sales', (select coalesce(sum(total), 0) from orders),
    'commission', (select coalesce(sum(commission), 0) from orders),
    'expenses', (select coalesce(sum(amount), 0) from expenses),
    'expenses_by_category', (
      select coalesce(jsonb_object_agg(category, amount), '{}'::jsonb)
      from (select category, sum(amount) as amount from expenses group by category) c
    ),
    'by_channel', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'channel', channel, 'orders', n, 'sales', sales, 'commission', commission
             ) order by sales desc), '[]'::jsonb)
      from (select channel, count(*) as n, sum(total) as sales, sum(commission) as commission
            from orders group by channel) c
    ),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', day, 'orders', n, 'sales', sales
             ) order by day), '[]'::jsonb)
      from (select day, count(*) as n, sum(total) as sales from orders group by day) d
    ),
    -- Item cost is estimated from today's recipe costs.
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', name, 'quantity', quantity, 'sales', sales, 'cost', cost
             ) order by quantity desc, sales desc), '[]'::jsonb)
      from (
        select m.name, sum(oi.quantity) as quantity, sum(oi.quantity * oi.unit_price) as sales,
               sum(oi.quantity) * coalesce(c.recipe_cost, 0) as cost
        from orders o
        join public.order_items oi on oi.order_id = o.id
        join public.menu_items m on m.id = oi.menu_item_id
        left join public.menu_item_costs c on c.menu_item_id = m.id
        group by m.id, m.name, c.recipe_cost
      ) i
    )
  );
$$;

revoke execute on function public.report_summary(date, date) from public, anon;
grant execute on function public.report_summary(date, date) to authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- 5. Customer ordering website
-- ══════════════════════════════════════════════════════════════════════

-- ── Orders: new channel, "new" status (awaiting confirmation) and website details ──
alter table public.orders drop constraint orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('whatsapp', 'phone', 'instagram', 'foodpanda', 'website'));

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'pending', 'preparing', 'delivered', 'cancelled'));

alter table public.orders
  add column delivery_address text,
  add column requested_payment text check (requested_payment in ('cash', 'wallet')),
  -- Secret code in the customer's order status link.
  add column public_token uuid not null unique default gen_random_uuid(),
  add column cancel_reason text;

alter table public.customers add column address text;

-- ── Shop settings shown on the website ──
alter table public.settings
  add column taking_orders boolean not null default true,
  add column opening_time time not null default '12:00',
  add column last_order_time time not null default '22:30',
  add column closing_time time not null default '23:00',
  add column min_lead_minutes integer not null default 30 check (min_lead_minutes between 0 and 240),
  -- Mobile wallet (e.g. JazzCash, Easypaisa) number customers pay to; its name is in brand.json.
  add column wallet_number text not null default '',
  add column contact_whatsapp text not null default '',
  add column delivery_area text not null default 'our area';

-- ── Stock demand now also counts orders waiting for confirmation ──
create or replace view public.ingredient_demand
with (security_invoker = true) as
select u.ingredient_id, sum(u.quantity) as needed
from public.orders o
cross join lateral public.order_ingredient_usage(o.id) u
where o.status in ('new', 'pending', 'preparing')
group by u.ingredient_id;

-- ── Staff: edit new or pending orders; status changes clear old cancel reasons ──
create or replace function public.save_order(payload jsonb, items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_customer_id uuid := nullif(payload ->> 'customer_id', '')::uuid;
  v_channel text := payload ->> 'channel';
  v_rate numeric := 0;
begin
  if jsonb_array_length(coalesce(items, '[]'::jsonb)) = 0 then
    raise exception 'An order needs at least one item';
  end if;

  if payload -> 'new_customer' ->> 'name' is not null then
    insert into public.customers (name, phone)
    values (trim(payload -> 'new_customer' ->> 'name'),
            nullif(trim(payload -> 'new_customer' ->> 'phone'), ''))
    returning id into v_customer_id;
  end if;

  if v_channel = 'foodpanda' then
    select foodpanda_commission_rate into v_rate from public.settings;
  end if;

  if v_order_id is null then
    insert into public.orders (customer_id, channel, delivery_at, discount, commission_rate, notes)
    values (v_customer_id, v_channel, (payload ->> 'delivery_at')::timestamptz,
            coalesce((payload ->> 'discount')::numeric, 0), v_rate, payload ->> 'notes')
    returning id into v_order_id;
  else
    update public.orders
    set customer_id = v_customer_id,
        channel = v_channel,
        delivery_at = (payload ->> 'delivery_at')::timestamptz,
        discount = coalesce((payload ->> 'discount')::numeric, 0),
        commission_rate = v_rate,
        notes = payload ->> 'notes'
    where id = v_order_id and status in ('new', 'pending');
    if not found then
      raise exception 'Only new or pending orders can be edited';
    end if;
    delete from public.order_items where order_items.order_id = v_order_id;
  end if;

  -- Prices are taken from the menu here, not from the phone.
  insert into public.order_items (order_id, menu_item_id, quantity, unit_price)
  select v_order_id, m.id, (i ->> 'quantity')::integer,
         case when v_channel = 'foodpanda' then coalesce(m.foodpanda_price, m.price) else m.price end
  from jsonb_array_elements(items) as i
  join public.menu_items m on m.id = (i ->> 'menu_item_id')::uuid;

  return v_order_id;
end;
$$;

create or replace function public.set_order_status(p_order_id uuid, p_status text, p_payment_method text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel text;
  v_old_status text;
  u record;
begin
  select channel, status into v_channel, v_old_status
  from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_status = 'delivered' then
    if v_channel = 'foodpanda' then
      p_payment_method := 'foodpanda';
    elsif p_payment_method is null or p_payment_method = 'foodpanda' then
      raise exception 'Choose cash or bank transfer';
    end if;
    if v_old_status <> 'delivered' then
      for u in select * from public.order_ingredient_usage(p_order_id) loop
        perform public.apply_stock_change(u.ingredient_id, -u.quantity, 'order', p_order_id);
      end loop;
    end if;
    update public.orders
    set status = 'delivered', payment_method = p_payment_method, delivered_at = now(), cancel_reason = null
    where id = p_order_id;
  else
    if v_old_status = 'delivered' then
      for u in select * from public.order_ingredient_usage(p_order_id) loop
        perform public.apply_stock_change(u.ingredient_id, u.quantity, 'order_undone', p_order_id);
      end loop;
    end if;
    update public.orders
    set status = p_status, payment_method = null, delivered_at = null,
        cancel_reason = case when p_status = 'cancelled' then cancel_reason end
    where id = p_order_id;
  end if;
end;
$$;

-- Rejects a website order (or cancels any active order) with a reason.
create function public.reject_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.set_order_status(p_order_id, 'cancelled');
  update public.orders set cancel_reason = nullif(trim(p_reason), '') where id = p_order_id;
end;
$$;

-- ── Helpers ──

-- Normalises Pakistani mobile numbers to 03XXXXXXXXX; returns null if invalid.
-- Adjust this for other countries: it validates customer phone numbers on the website.
create function public.normalize_pk_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^03[0-9]{9}$' then d
    when d ~ '^923[0-9]{9}$' then '0' || substr(d, 3)
    when d ~ '^3[0-9]{9}$' then '0' || d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) x;
$$;

-- Menu items that can't be made with stock left after active orders.
create function public.sold_out_menu_items()
returns table (menu_item_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct r.menu_item_id
  from public.recipe_lines r
  join public.ingredients i on i.id = r.ingredient_id
  left join public.ingredient_demand d on d.ingredient_id = i.id
  where i.current_stock - coalesce(d.needed, 0) < r.quantity;
$$;

-- Shop status in the business's time zone.
create function public.shop_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'open', s.taking_orders and t.now_time >= s.opening_time and t.now_time < s.last_order_time,
    'taking_orders', s.taking_orders,
    'opening_time', to_char(s.opening_time, 'HH24:MI'),
    'last_order_time', to_char(s.last_order_time, 'HH24:MI'),
    'closing_time', to_char(s.closing_time, 'HH24:MI'),
    'min_lead_minutes', s.min_lead_minutes,
    'now', to_char(t.now_local, 'YYYY-MM-DD"T"HH24:MI'),
    'wallet_number', s.wallet_number,
    'contact_whatsapp', s.contact_whatsapp,
    'delivery_area', s.delivery_area
  )
  from public.settings s,
       lateral (select now() at time zone public.app_time_zone() as now_local,
                       (now() at time zone public.app_time_zone())::time as now_time) t;
$$;

-- ── Public functions (the only things the website can call) ──

-- Menu and shop status for the website. Never exposes costs, stock or customers.
create function public.get_public_menu()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'shop', public.shop_status(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'name', m.name, 'category', m.category, 'price', m.price,
               'sold_out', exists (select 1 from public.sold_out_menu_items() s where s.menu_item_id = m.id)
             ) order by m.category, m.sort_order, m.name)
      from public.menu_items m
      where m.is_active
    ), '[]'::jsonb)
  );
$$;

-- Places a website order after checking everything on the server.
-- payload: {name, phone, address, notes?, delivery_time? ("HH:MM", null = ASAP),
--           payment: "cash" | "wallet", items: [{menu_item_id, quantity}], company?: honeypot}
create function public.place_website_order(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := trim(payload ->> 'name');
  v_phone text := public.normalize_pk_phone(payload ->> 'phone');
  v_address text := trim(payload ->> 'address');
  v_notes text := nullif(trim(payload ->> 'notes'), '');
  v_payment text := payload ->> 'payment';
  v_shop jsonb := public.shop_status();
  v_now timestamptz := now();
  v_earliest timestamptz;
  v_latest timestamptz;
  v_delivery timestamptz;
  v_customer_id uuid;
  v_order_id uuid;
  v_token uuid;
  v_number bigint;
  v_total_qty integer;
  v_item_count integer;
  v_cart jsonb;
begin
  -- Bots fill in the hidden "company" field; people never see it.
  if coalesce(payload ->> 'company', '') <> '' then
    raise exception 'Could not place the order';
  end if;

  if not (v_shop ->> 'open')::boolean then
    raise exception 'Sorry, we are not taking orders right now';
  end if;

  if v_name is null or length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'Please enter your name';
  end if;
  if v_phone is null then
    raise exception 'Please enter a valid mobile number, like 0300 1234567';
  end if;
  if v_address is null or length(v_address) < 5 or length(v_address) > 300 then
    raise exception 'Please enter your delivery address';
  end if;
  if v_notes is not null and length(v_notes) > 500 then
    raise exception 'Notes are too long';
  end if;
  if v_payment is null or v_payment not in ('cash', 'wallet') then
    raise exception 'Please choose how you will pay';
  end if;

  -- Delivery time: today, at least min_lead_minutes from now, and before closing.
  v_earliest := v_now + make_interval(mins => (v_shop ->> 'min_lead_minutes')::integer);
  v_latest := ((v_now at time zone public.app_time_zone())::date + (v_shop ->> 'closing_time')::time)
              at time zone public.app_time_zone();
  if nullif(payload ->> 'delivery_time', '') is null then
    v_delivery := v_earliest;
  else
    v_delivery := ((v_now at time zone public.app_time_zone())::date + (payload ->> 'delivery_time')::time)
                  at time zone public.app_time_zone();
    if v_delivery < v_earliest - interval '1 minute' then
      raise exception 'Please choose a delivery time at least % minutes from now', v_shop ->> 'min_lead_minutes';
    end if;
  end if;
  if v_delivery > v_latest then
    raise exception 'Please choose a delivery time before %', v_shop ->> 'closing_time';
  end if;

  -- Items: combine duplicates, check quantities, availability and stock.
  select coalesce(jsonb_agg(jsonb_build_object('menu_item_id', menu_item_id, 'quantity', quantity)), '[]'::jsonb),
         count(*), coalesce(sum(quantity), 0)
  into v_cart, v_item_count, v_total_qty
  from (
    select (i ->> 'menu_item_id')::uuid as menu_item_id, sum((i ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) as i
    group by 1
  ) x;

  if v_item_count = 0 then
    raise exception 'Your cart is empty';
  end if;
  if exists (select 1 from jsonb_to_recordset(v_cart) as c (menu_item_id uuid, quantity integer)
             where c.quantity < 1 or c.quantity > 20) or v_total_qty > 30 then
    raise exception 'For orders this large, please contact us on WhatsApp';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_cart) as c (menu_item_id uuid, quantity integer)
    left join public.menu_items m on m.id = c.menu_item_id and m.is_active
    where m.id is null
  ) then
    raise exception 'Some items in your cart are no longer available. Please refresh the menu';
  end if;
  if exists (select 1 from jsonb_to_recordset(v_cart) as c (menu_item_id uuid, quantity integer)
             join public.sold_out_menu_items() s on s.menu_item_id = c.menu_item_id) then
    raise exception 'Some items in your cart just sold out. Please refresh the menu';
  end if;
  -- Enough stock for the whole cart, on top of orders already waiting?
  if exists (
    select 1
    from jsonb_to_recordset(v_cart) as c (menu_item_id uuid, quantity integer)
    join public.recipe_lines r on r.menu_item_id = c.menu_item_id
    join public.ingredients i on i.id = r.ingredient_id
    left join public.ingredient_demand d on d.ingredient_id = i.id
    group by i.id, i.current_stock, d.needed
    having i.current_stock - coalesce(d.needed, 0) < sum(c.quantity * r.quantity)
  ) then
    raise exception 'Sorry, we can''t make that many right now. Please reduce the quantity';
  end if;

  -- Rate limits.
  if (
    select count(*) from public.orders o
    join public.customers cu on cu.id = o.customer_id
    where o.status = 'new' and public.normalize_pk_phone(cu.phone) = v_phone
  ) >= 3 then
    raise exception 'You already have orders waiting for confirmation. We will contact you shortly';
  end if;
  if (
    select count(*) from public.orders
    where channel = 'website' and created_at > v_now - interval '10 minutes'
  ) >= 10 then
    raise exception 'We are receiving a lot of orders right now. Please try again in a few minutes or WhatsApp us';
  end if;

  -- Match an existing customer by phone, or add a new one.
  select id into v_customer_id
  from public.customers
  where public.normalize_pk_phone(phone) = v_phone
  order by created_at
  limit 1;
  if v_customer_id is null then
    insert into public.customers (name, phone, address)
    values (v_name, v_phone, v_address)
    returning id into v_customer_id;
  else
    update public.customers set address = coalesce(address, v_address) where id = v_customer_id;
  end if;

  insert into public.orders (customer_id, channel, status, delivery_at, notes, delivery_address, requested_payment)
  values (v_customer_id, 'website', 'new', v_delivery,
          case when v_notes is null then 'Website order – name given: ' || v_name
               else v_notes || E'\n(Name given: ' || v_name || ')' end,
          v_address, v_payment)
  returning id, public_token, number into v_order_id, v_token, v_number;

  insert into public.order_items (order_id, menu_item_id, quantity, unit_price)
  select v_order_id, m.id, c.quantity, m.price
  from jsonb_to_recordset(v_cart) as c (menu_item_id uuid, quantity integer)
  join public.menu_items m on m.id = c.menu_item_id;

  return jsonb_build_object('token', v_token, 'number', v_number);
end;
$$;

-- Order status for the customer's status page, found by its secret code.
create function public.get_order_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number,
    'status', o.status,
    'delivery_at', o.delivery_at,
    'requested_payment', o.requested_payment,
    'cancel_reason', o.cancel_reason,
    'total', greatest(coalesce(sum(oi.quantity * oi.unit_price), 0) - o.discount, 0),
    'items', coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'quantity', oi.quantity, 'price', oi.unit_price)
                                order by m.name) filter (where oi.order_id is not null), '[]'::jsonb),
    'wallet_number', s.wallet_number,
    'contact_whatsapp', s.contact_whatsapp
  )
  from public.orders o
  cross join public.settings s
  left join public.order_items oi on oi.order_id = o.id
  left join public.menu_items m on m.id = oi.menu_item_id
  where o.public_token = p_token and o.channel = 'website'
  group by o.id, s.wallet_number, s.contact_whatsapp;
$$;

-- ── Permissions ──
revoke execute on function public.reject_order(uuid, text) from public, anon;
revoke execute on function public.normalize_pk_phone(text) from public, anon;
revoke execute on function public.sold_out_menu_items() from public, anon;
revoke execute on function public.shop_status() from public, anon;
grant execute on function public.reject_order(uuid, text) to authenticated;
grant execute on function public.normalize_pk_phone(text) to authenticated;
grant execute on function public.sold_out_menu_items() to authenticated;
grant execute on function public.shop_status() to authenticated;

-- The website (anon key) can only call these three.
revoke execute on function public.get_public_menu() from public;
revoke execute on function public.place_website_order(jsonb) from public;
revoke execute on function public.get_order_status(uuid) from public;
grant execute on function public.get_public_menu() to anon, authenticated;
grant execute on function public.place_website_order(jsonb) to anon, authenticated;
grant execute on function public.get_order_status(uuid) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- 6. Push notifications for new website orders
-- ══════════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;

-- One row per staff phone that turned notifications on.
-- Address of the notify-new-order Edge Function, e.g.
-- https://<project-ref>.supabase.co/functions/v1/notify-new-order. Alerts are skipped while empty.
alter table public.settings add column notify_url text;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy "Signed-in users have full access" on public.push_subscriptions
  for all to authenticated using (true) with check (true);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- When staff were alerted about an order, so an alert is only ever sent once.
alter table public.orders add column notified_at timestamptz;

-- Called by the notify-new-order function (service role only). Marks a fresh website
-- order as notified and returns what the alert should say, or null if there's nothing to send.
create function public.claim_order_notification(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set notified_at = now()
  where id = p_order_id
    and channel = 'website'
    and status = 'new'
    and notified_at is null
    and created_at > now() - interval '15 minutes'
  returning * into v_order;

  if not found then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'id', v_order.id,
      'number', v_order.number,
      'customer', c.name,
      'delivery_at', v_order.delivery_at,
      'items', coalesce(sum(oi.quantity), 0),
      'total', greatest(coalesce(sum(oi.quantity * oi.unit_price), 0) - v_order.discount, 0)
    )
    from public.order_items oi
    left join public.customers c on c.id = v_order.customer_id
    where oi.order_id = v_order.id
    group by c.name
  );
end;
$$;

revoke execute on function public.claim_order_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_order_notification(uuid) to service_role;

-- Ask the notify-new-order function to alert staff. pg_net sends the request after
-- the order (and its items) are committed, without slowing down the customer.
create function public.notify_new_website_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select notify_url from public.settings);
begin
  if v_url is not null and v_url <> '' then
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('order_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_new_website_order() from public, anon, authenticated;

create trigger orders_notify_new_website_order
after insert on public.orders
for each row
when (new.channel = 'website')
execute function public.notify_new_website_order();


-- ══════════════════════════════════════════════════════════════════════
-- 7. Reminder notifications
-- ══════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

alter table public.orders
  add column alert_count integer not null default 0,
  add column last_alert_at timestamptz;

-- Also hands out reminders when they're due.
-- Returns what the alert should say, or null if nothing is due (so extra calls are harmless).
create or replace function public.claim_order_notification(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set alert_count = alert_count + 1,
      last_alert_at = now(),
      notified_at = coalesce(notified_at, now())
  where id = p_order_id
    and channel = 'website'
    and status = 'new'
    and (
      (alert_count = 0 and created_at > now() - interval '15 minutes')
      -- 170 seconds rather than 180, so a once-a-minute check never skips a beat.
      or (alert_count between 1 and 5 and last_alert_at <= now() - interval '170 seconds')
    )
  returning * into v_order;

  if not found then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'id', v_order.id,
      'number', v_order.number,
      'customer', c.name,
      'delivery_at', v_order.delivery_at,
      'items', coalesce(sum(oi.quantity), 0),
      'total', greatest(coalesce(sum(oi.quantity * oi.unit_price), 0) - v_order.discount, 0),
      -- 0 for the first alert, then 1–5 for reminders.
      'reminder', v_order.alert_count - 1,
      'waiting_minutes', floor(extract(epoch from now() - v_order.created_at) / 60)
    )
    from public.order_items oi
    left join public.customers c on c.id = v_order.customer_id
    where oi.order_id = v_order.id
    group by c.name
  );
end;
$$;

-- Asks the notify-new-order function to send a reminder for each website order that's due one.
create function public.send_order_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
  v_url text := (select notify_url from public.settings);
begin
  if v_url is null or v_url = '' then
    return 0;
  end if;
  for v_order in
    select id from public.orders
    where channel = 'website'
      and status = 'new'
      and alert_count between 1 and 5
      and last_alert_at <= now() - interval '170 seconds'
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('order_id', v_order.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.send_order_reminders() from public, anon, authenticated;

-- Check once a minute.
select cron.schedule('website-order-reminders', '* * * * *', 'select public.send_order_reminders()');


-- ══════════════════════════════════════════════════════════════════════
-- 8. Customer order codes (e.g. BURGER-7KQ)
-- ══════════════════════════════════════════════════════════════════════

alter table public.orders add column code text unique;

-- Optional custom words per menu category, e.g. ('Sandwiches', 'SANDO'). Categories not listed
-- use their own name, e.g. "Burgers" → BURGER.
create table public.order_code_words (
  category text primary key,
  word text not null check (word ~ '^[A-Z]{2,10}$')
);

alter table public.order_code_words enable row level security;
create policy "Signed-in users have full access" on public.order_code_words
  for all to authenticated using (true) with check (true);
revoke all on public.order_code_words from anon;
grant select, insert, update, delete on public.order_code_words to authenticated;

create function public.order_code_word(p_category text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select word from public.order_code_words where category = p_category),
    nullif(upper(regexp_replace(regexp_replace(p_category, '[^A-Za-z]', '', 'g'), 'S$', '', 'i')), ''),
    'ORDER'
  );
$$;

-- Gives an order its code (if it doesn't have one yet) and returns it.
create function public.assign_order_code(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_word text;
  v_code text;
begin
  select code into v_code from public.orders where id = p_order_id;
  if v_code is not null then
    return v_code;
  end if;

  -- Most-ordered category (by quantity, then by value).
  select public.order_code_word(m.category) into v_word
  from public.order_items oi
  join public.menu_items m on m.id = oi.menu_item_id
  where oi.order_id = p_order_id
  group by m.category
  order by sum(oi.quantity) desc, sum(oi.quantity * oi.unit_price) desc
  limit 1;
  v_word := coalesce(v_word, 'ORDER');

  loop
    v_code := v_word || '-' || (
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
      from generate_series(1, 3)
    );
    begin
      update public.orders set code = v_code where id = p_order_id;
      return v_code;
    exception when unique_violation then
      -- Already taken by another order; pick another ending.
    end;
  end loop;
end;
$$;

revoke execute on function public.assign_order_code(uuid) from public, anon, authenticated;
revoke execute on function public.order_code_word(text) from public, anon;

-- New orders get their code as soon as their items are saved (staff app and website alike).
create function public.assign_codes_for_new_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select distinct n.order_id
    from new_items n
    join public.orders o on o.id = n.order_id
    where o.code is null
  loop
    perform public.assign_order_code(v_order_id);
  end loop;
  return null;
end;
$$;

revoke execute on function public.assign_codes_for_new_items() from public, anon, authenticated;

create trigger order_items_assign_order_code
after insert on public.order_items
referencing new table as new_items
for each statement
execute function public.assign_codes_for_new_items();

-- Customer order page, including the code.
create or replace function public.get_order_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number,
    'code', o.code,
    'status', o.status,
    'delivery_at', o.delivery_at,
    'requested_payment', o.requested_payment,
    'cancel_reason', o.cancel_reason,
    'total', greatest(coalesce(sum(oi.quantity * oi.unit_price), 0) - o.discount, 0),
    'items', coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'quantity', oi.quantity, 'price', oi.unit_price)
                                order by m.name) filter (where oi.order_id is not null), '[]'::jsonb),
    'wallet_number', s.wallet_number,
    'contact_whatsapp', s.contact_whatsapp
  )
  from public.orders o
  cross join public.settings s
  left join public.order_items oi on oi.order_id = o.id
  left join public.menu_items m on m.id = oi.menu_item_id
  where o.public_token = p_token and o.channel = 'website'
  group by o.id, s.wallet_number, s.contact_whatsapp;
$$;

-- Staff notifications, including the code.
create or replace function public.claim_order_notification(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set alert_count = alert_count + 1,
      last_alert_at = now(),
      notified_at = coalesce(notified_at, now())
  where id = p_order_id
    and channel = 'website'
    and status = 'new'
    and (
      (alert_count = 0 and created_at > now() - interval '15 minutes')
      -- 170 seconds rather than 180, so a once-a-minute check never skips a beat.
      or (alert_count between 1 and 5 and last_alert_at <= now() - interval '170 seconds')
    )
  returning * into v_order;

  if not found then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'id', v_order.id,
      'number', v_order.number,
      'code', v_order.code,
      'customer', c.name,
      'delivery_at', v_order.delivery_at,
      'items', coalesce(sum(oi.quantity), 0),
      'total', greatest(coalesce(sum(oi.quantity * oi.unit_price), 0) - v_order.discount, 0),
      -- 0 for the first alert, then 1–5 for reminders.
      'reminder', v_order.alert_count - 1,
      'waiting_minutes', floor(extract(epoch from now() - v_order.created_at) / 60)
    )
    from public.order_items oi
    left join public.customers c on c.id = v_order.customer_id
    where oi.order_id = v_order.id
    group by c.name
  );
end;
$$;


-- ══════════════════════════════════════════════════════════════════════
-- 9. Staff names
-- ══════════════════════════════════════════════════════════════════════

create table public.staff_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  email text,
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles enable row level security;

-- Everyone signed in can see all staff names; each person can only set their own.
create policy "Signed-in users can read" on public.staff_profiles
  for select to authenticated using (true);
create policy "Staff can add their own profile" on public.staff_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy "Staff can update their own profile" on public.staff_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.staff_profiles from anon;
grant select, insert, update on public.staff_profiles to authenticated;

-- Start everyone off with the first part of their login email; each person can change it in Settings.
insert into public.staff_profiles (user_id, name, email)
select id, initcap(split_part(email, '@', 1)), email
from auth.users
where email is not null
on conflict (user_id) do nothing;
