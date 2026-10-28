-- Home Kitchen POS: demo data (optional).
-- A small burger & fries menu with recipes, stock and costs, so you can try everything
-- straight away. Run after setup.sql. Replace it with your own menu any time from the app
-- (More → Menu & recipes, and Stock), or delete it with the statements at the bottom.

update public.settings set
  delivery_area = 'Model Town',
  contact_whatsapp = '03001234567',
  wallet_number = '03001234567';

-- Ingredients and packaging. Quantities are in g, ml or pcs; cost is per g / ml / pc.
insert into public.ingredients (name, unit, current_stock, low_stock_threshold, cost_per_unit, is_packaging, round_up_per_order) values
  ('Burger bun',       'pcs',    40,    10,   30,    false, false),
  ('Beef patty',       'pcs',    30,     8,  180,    false, false),
  ('Chicken fillet',   'pcs',    30,     8,  150,    false, false),
  ('Cheese slice',     'pcs',    60,    15,   25,    false, false),
  ('Lettuce',          'g',    2000,   300,    0.4,  false, false),
  ('Tomato',           'g',    3000,   500,    0.25, false, false),
  ('House sauce',      'g',    3000,   500,    0.6,  false, false),
  ('Tortilla wrap',    'pcs',    40,    10,   35,    false, false),
  ('Chicken strips',   'g',    5000,  1000,    1.1,  false, false),
  ('Frozen fries',     'g',   10000,  2000,    0.5,  false, false),
  ('Cheese sauce',     'ml',   2000,   400,    0.9,  false, false),
  ('Lemon juice',      'ml',   2000,   300,    0.3,  false, false),
  ('Sugar syrup',      'ml',   3000,   500,    0.15, false, false),
  ('Milk',             'ml',  10000,  2000,    0.22, false, false),
  ('Coffee',           'g',     500,   100,    6,    false, false),
  ('Brownie',          'pcs',    20,     5,   90,    false, false),
  ('Burger box',       'pcs',   100,    20,   12,    true,  false),
  ('Fries box',        'pcs',   100,    20,    8,    true,  false),
  ('Wrap paper',       'pcs',   200,    40,    3,    true,  false),
  ('Cup with lid',     'pcs',   100,    20,   15,    true,  false),
  ('Straw',            'pcs',   200,    40,    1,    true,  false),
  -- One paper bag holds 2 items: recipes use 0.5 and each order rounds up.
  ('Paper bag',        'pcs',   100,    20,   10,    true,  true);

insert into public.menu_items (name, category, price, foodpanda_price, sort_order) values
  ('Classic Beef Burger',   'Burgers',  650,  850, 1),
  ('Crispy Chicken Burger', 'Burgers',  600,  790, 2),
  ('Chicken Wrap',          'Wraps',    550,  720, 1),
  ('Regular Fries',         'Fries',    250,  330, 1),
  ('Cheesy Fries',          'Fries',    400,  520, 2),
  ('Fresh Lemonade',        'Drinks',   250,  330, 1),
  ('Iced Coffee',           'Drinks',   400,  520, 2),
  ('Fudge Brownie',         'Desserts', 300,  390, 1);

insert into public.recipe_lines (menu_item_id, ingredient_id, quantity)
select m.id, i.id, r.quantity
from (values
  ('Classic Beef Burger', 'Burger bun', 1), ('Classic Beef Burger', 'Beef patty', 1), ('Classic Beef Burger', 'Cheese slice', 1),
  ('Classic Beef Burger', 'Lettuce', 15), ('Classic Beef Burger', 'Tomato', 25), ('Classic Beef Burger', 'House sauce', 20),
  ('Classic Beef Burger', 'Burger box', 1), ('Classic Beef Burger', 'Paper bag', 0.5),
  ('Crispy Chicken Burger', 'Burger bun', 1), ('Crispy Chicken Burger', 'Chicken fillet', 1), ('Crispy Chicken Burger', 'Lettuce', 15),
  ('Crispy Chicken Burger', 'House sauce', 20), ('Crispy Chicken Burger', 'Burger box', 1), ('Crispy Chicken Burger', 'Paper bag', 0.5),
  ('Chicken Wrap', 'Tortilla wrap', 1), ('Chicken Wrap', 'Chicken strips', 120), ('Chicken Wrap', 'Lettuce', 15),
  ('Chicken Wrap', 'Tomato', 20), ('Chicken Wrap', 'House sauce', 20), ('Chicken Wrap', 'Wrap paper', 1), ('Chicken Wrap', 'Paper bag', 0.5),
  ('Regular Fries', 'Frozen fries', 200), ('Regular Fries', 'Fries box', 1), ('Regular Fries', 'Paper bag', 0.5),
  ('Cheesy Fries', 'Frozen fries', 200), ('Cheesy Fries', 'Cheese sauce', 50), ('Cheesy Fries', 'Fries box', 1), ('Cheesy Fries', 'Paper bag', 0.5),
  ('Fresh Lemonade', 'Lemon juice', 40), ('Fresh Lemonade', 'Sugar syrup', 30), ('Fresh Lemonade', 'Cup with lid', 1), ('Fresh Lemonade', 'Straw', 1),
  ('Iced Coffee', 'Milk', 250), ('Iced Coffee', 'Coffee', 4), ('Iced Coffee', 'Sugar syrup', 20), ('Iced Coffee', 'Cup with lid', 1), ('Iced Coffee', 'Straw', 1),
  ('Fudge Brownie', 'Brownie', 1), ('Fudge Brownie', 'Paper bag', 0.5)
) as r (item, ingredient, quantity)
join public.menu_items m on m.name = r.item
join public.ingredients i on i.name = r.ingredient;

-- Fun words for order codes, e.g. SIP-7KQ for a drinks order (others use the category name).
insert into public.order_code_words (category, word) values
  ('Drinks', 'SIP'),
  ('Desserts', 'SWEET');

-- To remove the demo menu later (only before you have real orders that use it):
--   delete from public.recipe_lines;
--   delete from public.menu_items;
--   delete from public.stock_movements;
--   delete from public.ingredients;
--   delete from public.order_code_words;
