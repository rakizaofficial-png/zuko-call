/**
 * Short, pleasant WebAudio chimes for live gifts (no asset downloads).
 */

let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function tone(
  freqs: number[],
  durationSec: number,
  type: OscillatorType = "sine",
  peak = 0.18,
) {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.value = 0.0001;
  master.connect(audio.destination);

  for (const freq of freqs) {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(master);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  master.gain.exponentialRampToValueAtTime(peak, now + 0.03);
  master.gain.setValueAtTime(peak, now + durationSec * 0.55);
  master.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
}

/** Soft sparkle for small gifts */
export function playGiftChime(coins = 1) {
  if (coins >= 250) {
    // Cinematic sweep
    tone([523.25, 659.25, 783.99, 1046.5], 0.55, "triangle", 0.22);
    setTimeout(() => tone([880, 1174.7], 0.35, "sine", 0.14), 180);
    try {
      navigator.vibrate?.([30, 40, 60]);
    } catch {
      /* ignore */
    }
    return;
  }
  if (coins >= 99) {
    tone([587.33, 739.99, 880], 0.38, "triangle", 0.2);
    return;
  }
  tone([659.25, 830.61], 0.22, "sine", 0.16);
}

/** Unlock success flourish */
export function playUnlockChime() {
  tone([523.25, 659.25, 783.99], 0.4, "triangle", 0.2);
  setTimeout(() => tone([1046.5], 0.28, "sine", 0.12), 220);
}
