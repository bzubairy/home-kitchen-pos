import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import brand from '../brand.json' with { type: 'json' }

// https://vite.dev/config/
// Fills {{brand.*}} placeholders in index.html (title, link previews) from brand.json.
function brandHtml(): Plugin {
  return {
    name: 'brand-html',
    transformIndexHtml: (html) =>
      html.replace(/\{\{brand\.(\w+)\}\}/g, (_, key: string) => String((brand as Record<string, unknown>)[key] ?? '')),
  }
}

export default defineConfig({
  // brand.json lives at the repository root, shared with the staff app.
  server: { fs: { allow: ['..'] } },
  plugins: [react(), tailwindcss(), brandHtml()],
})
