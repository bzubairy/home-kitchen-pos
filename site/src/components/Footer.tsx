import brand from '../brand'
import { INSTAGRAM_URL, prettyPhone, whatsappLink } from '../lib/format'

export default function Footer({ whatsapp }: { whatsapp?: string }) {
  return (
    <footer className="mt-10 space-y-3 pb-8 text-center text-sm text-ink-soft">
      <div className="flex justify-center gap-3">
        {whatsapp && (
          <a href={whatsappLink(whatsapp)} target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2 text-sm">
            WhatsApp {prettyPhone(whatsapp)}
          </a>
        )}
        {INSTAGRAM_URL && (
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2 text-sm">
            Instagram
          </a>
        )}
      </div>
      <p>© {brand.name}{brand.tagline ? ` · ${brand.tagline}` : ''}</p>
    </footer>
  )
}
