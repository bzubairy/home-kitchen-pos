import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { forgetStaffNames } from '../lib/staff'
import { supabase } from '../lib/supabase'
import ErrorMessage from './ErrorMessage'

/** The signed-in person's name, shown on orders they take ("by Sara"). */
export default function StaffNameSettings() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('staff_profiles')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setName(data?.name ?? session?.user.email?.split('@')[0] ?? ''))
  }, [userId, session])

  async function save() {
    setError(null)
    setSaved(false)
    const { error } = await supabase
      .from('staff_profiles')
      .upsert({ user_id: userId, name: name.trim(), email: session?.user.email, updated_at: new Date().toISOString() })
    if (error) return setError(error.message)
    forgetStaffNames()
    setSaved(true)
  }

  return (
    <div className="card space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Your name (shown on orders you take)</span>
        <div className="flex gap-2">
          <input value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setSaved(false) }} className="input" />
          <button type="button" onClick={save} disabled={!name.trim()} className="btn-secondary shrink-0">{saved ? '✓ Saved' : 'Save'}</button>
        </div>
      </label>
      <ErrorMessage message={error} />
    </div>
  )
}
