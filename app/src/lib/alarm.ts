// Loud "ding-dong" alarm for new website orders while the app is open.

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    return ctx
  } catch {
    return null
  }
}

/**
 * Phones only allow sound after the user has touched the page, so the first tap
 * anywhere "unlocks" audio for later alarms. On iPhone this also lets the alarm
 * play when the ring/silent switch is on silent (iOS 17+).
 */
export function setupAlarmAudio() {
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) nav.audioSession.type = 'playback'
  const unlock = () => {
    const a = audio()
    if (a?.state === 'suspended') a.resume().catch(() => {})
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  return () => window.removeEventListener('pointerdown', unlock)
}

function tone(a: AudioContext, frequency: number, start: number, length: number) {
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = 'triangle'
  osc.frequency.value = frequency
  // Quick fade in/out avoids clicks; peak volume is high on purpose.
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.9, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain).connect(a.destination)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

/** Three loud ding-dongs (about 2.5 seconds) plus a long vibration on Android. */
export function playAlarm() {
  const a = audio()
  if (a) {
    if (a.state === 'suspended') a.resume().catch(() => {})
    const t = a.currentTime + 0.05
    for (let i = 0; i < 3; i++) {
      tone(a, 1318, t + i * 0.8, 0.35) // E6
      tone(a, 988, t + i * 0.8 + 0.35, 0.45) // B5
    }
  }
  navigator.vibrate?.([500, 150, 500, 150, 500])
}
