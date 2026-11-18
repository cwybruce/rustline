// Procedural sound, all synthesized with WebAudio: no audio files, nothing fetched.
// An engine hum that follows the car's speed, a two-tone siren while the police are
// close, a gunshot crack, a pickup blip and a small mission jingle. Created lazily on
// the first user gesture, since browsers block audio before one.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function blip(frequency, duration, type, volume) {
    if (!ensure() || muted) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration);
  }

  function noiseBurst(duration, volume) {
    if (!ensure() || muted) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    /** Call on any user gesture so the browser unlocks audio. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum: speed 0..1 sets pitch and loudness; call every frame. */
    engine(speed01, driving) {
      if (!ensure() || muted) return;
      engineOsc.frequency.value = 52 + speed01 * 130;
      engineGain.gain.value = driving ? 0.05 + speed01 * 0.09 : 0;
    },
    /** Siren wail: call every frame with whether any police car is near. */
    siren(active, dt) {
      if (!ensure() || muted) return;
      sirenTimer += dt;
      if (!active) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenGain.gain.value = 0.045;
      sirenOsc.frequency.value = Math.floor(sirenTimer * 1.6) % 2 === 0 ? 720 : 960;
    },
    shot() {
      noiseBurst(0.12, 0.5);
      blip(140, 0.1, 'square', 0.25);
    },
    punch() {
      noiseBurst(0.07, 0.3);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      setTimeout(() => blip(990, 0.12, 'sine', 0.3), 70);
    },
    hurt() {
      blip(180, 0.18, 'sawtooth', 0.3);
    },
    mission() {
      [523, 659, 784, 1047].forEach((frequency, i) => {
        setTimeout(() => blip(frequency, 0.16, 'triangle', 0.35), i * 110);
      });
    },
    busted() {
      [392, 330, 262].forEach((frequency, i) => {
        setTimeout(() => blip(frequency, 0.22, 'triangle', 0.35), i * 160);
      });
    },
  };
}
