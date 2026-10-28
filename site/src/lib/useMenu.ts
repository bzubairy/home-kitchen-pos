import { useEffect, useState } from 'react'
import { getMenu, type PublicMenu } from './api'

/** Loads the public menu and shop status; reloads on every mount so prices and stock stay fresh. */
export function useMenu() {
  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    getMenu()
      .then((m) => {
        setMenu(m)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [version])

  return { menu, error, reload: () => setVersion((v) => v + 1) }
}
