import { useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush, isInstalled, isIOS, pushSupported, showTestNotification } from '../lib/push'
import ErrorMessage from './ErrorMessage'

type State = 'checking' | 'unsupported' | 'needs_install' | 'off' | 'on'

/** Lets each phone turn new-order push notifications on or off. */
export default function NotificationSettings() {
  const [state, setState] = useState<State>(() => {
    if (isIOS() && !isInstalled()) return 'needs_install'
    if (!pushSupported()) return 'unsupported'
    return 'checking'
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (state !== 'checking') return
    currentSubscription()
      .then((sub) => setState(sub && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [state])

  async function run(action: () => Promise<void>, next: State) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setState(next)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="font-medium">New website order alerts on this phone</p>
        <p className="text-sm text-stone-500">
          {state === 'on' && '✅ On. You\'ll get a notification for every new website order.'}
          {state === 'off' && 'Off. Turn on to get a notification even when the app is closed.'}
          {state === 'checking' && 'Checking…'}
          {state === 'needs_install' && 'On iPhone, open this app from its Home Screen icon (Safari → Share → Add to Home Screen) to turn on alerts.'}
          {state === 'unsupported' && "This browser can't receive notifications. Use Chrome on Android, or the Home Screen app on iPhone (iOS 16.4+)."}
        </p>
      </div>
      {state === 'off' && (
        <button type="button" disabled={busy} onClick={() => run(enablePush, 'on')} className="btn-primary w-full">
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
      )}
      {state === 'on' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => run(showTestNotification, 'on')} className="btn-secondary flex-1 py-2">Test</button>
          <button type="button" disabled={busy} onClick={() => run(disablePush, 'off')} className="btn-secondary flex-1 py-2">Turn off</button>
        </div>
      )}
      <ErrorMessage message={error} />
    </div>
  )
}
