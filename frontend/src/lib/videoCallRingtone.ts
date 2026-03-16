export function startVideoCallRingtone(): () => void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.gain.value = 0.2
    gain.connect(ctx.destination)

    let stopped = false
    const playChime = () => {
      if (stopped) return
      const t = ctx.currentTime
      const play = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        osc.start(start)
        osc.stop(start + duration)
      }
      play(523.25, t, 0.15)
      play(659.25, t + 0.2, 0.2)
    }

    playChime()
    const interval = window.setInterval(() => {
      if (stopped) return
      playChime()
    }, 2000)

    return () => {
      stopped = true
      clearInterval(interval)
      ctx.close().catch(() => {})
    }
  } catch {
    return () => {}
  }
}
