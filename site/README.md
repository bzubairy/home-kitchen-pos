# Customer ordering website

The public site where customers browse the menu, order and track their order. Orders arrive in the
staff app as **Website** orders. See the [main README](../README.md) for setup.

```sh
cp .env.example .env.local   # same Supabase URL and publishable key as the staff app
npm install
npm run dev
```

The site can only call three database functions (`get_public_menu`, `place_website_order`,
`get_order_status`); everything else is blocked for the public key.
