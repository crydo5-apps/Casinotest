class GatesAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      // no audio support
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  private noise(dur: number, vol = 0.06) {
    if (this.muted || !this.ctx) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * vol;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  spin() {
    this.noise(0.3, 0.04);
  }

  reelStop(index: number) {
    this.tone(200 + index * 40, 0.08, "triangle", 0.08);
  }

  land() {
    this.tone(440, 0.06, "sine", 0.05);
  }

  tumble() {
    this.tone(350, 0.15, "sine", 0.06);
    this.tone(280, 0.2, "triangle", 0.04);
  }

  winSmall() {
    const now = this.ctx?.currentTime ?? 0;
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.15, "sine", 0.08), i * 80);
    });
  }

  winBig() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.25, "sine", 0.1), i * 120);
    });
  }

  winMega() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.35, "sine", 0.12), i * 100);
    });
  }

  orbLand(value: number) {
    const freq = 200 + Math.min(value / 1000, 1) * 600;
    this.tone(freq, 0.3, "sine", 0.1);
    this.tone(freq * 1.5, 0.2, "triangle", 0.06);
  }

  scatterTrigger() {
    [330, 440, 550, 660, 880].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.3, "sawtooth", 0.06), i * 60);
    });
  }

  freeSpinsStart() {
    [392, 523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.4, "sine", 0.12), i * 100);
    });
  }

  freeSpinsEnd() {
    [784, 659, 523, 392].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.3, "sine", 0.08), i * 150);
    });
  }

  buttonClick() {
    this.tone(800, 0.04, "sine", 0.05);
  }

  tick() {
    this.tone(1200, 0.02, "sine", 0.03);
  }

  globalMultIncrease() {
    this.tone(660, 0.15, "sine", 0.08);
    this.tone(880, 0.2, "sine", 0.06);
  }
}

export const gatesAudio = new GatesAudio();
