# Staff app

The phone app for running the business: orders, stock, expenses, reports and settings.
Installable on iPhone and Android from the browser (PWA). See the [main README](../README.md) for setup.

```sh
cp .env.example .env.local   # fill in your Supabase URL and key
npm install
npm run dev                  # add -- --host to open it on a phone on the same Wi-Fi
```

- `supabase/setup.sql`: database setup (run once in the Supabase SQL Editor)
- `supabase/demo-data.sql`: optional sample menu
- `supabase/functions/notify-new-order`: Edge Function that sends new-order push notifications
