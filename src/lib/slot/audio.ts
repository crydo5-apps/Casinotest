type Bus = "master" | "sfx" | "music";

type DroneBits = {
  nodes: AudioNode[];
  oscs: OscillatorNode[];
  src?: AudioBufferSourceNode;
};

export class SlotAudio {
  private ctx: AudioContext | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private drone: DroneBits | null = null;
  private tombOn = false;
  private tombTimer = 0;
  private tombStep = 0;
  private tombKeep: { osc: OscillatorNode; gain: GainNode }[] = [];
  private noise: AudioBuffer | null = null;
  private spinTickTimer = 0;
  private spinFast = false;
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      const master = ctx.createGain();
      const sfx = ctx.createGain();
      const music = ctx.createGain();
      sfx.gain.value = 0.9;
      music.gain.value = 0.4;
      master.gain.value = this.muted ? 0 : 0.72;
      sfx.connect(master);
      music.connect(master);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.buses = { master, sfx, music };
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const master = this.buses?.master;
    const ctx = this.ctx;
    if (!master || !ctx) return;
    master.gain.setTargetAtTime(muted ? 0 : 0.72, ctx.currentTime, 0.03);
    if (muted) {
      this.stopDrone();
      this.stopTombTheme();
    }
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private dest(bus: Bus = "sfx"): AudioNode | null {
    return this.buses?.[bus] ?? null;
  }

  private env(
    dest: AudioNode,
    type: OscillatorType,
    freq: number,
    duration: number,
    peak = 0.18,
    startFreq?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq ?? freq, ctx.currentTime);
    if (startFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freq, 1), ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private noiseBurst(duration: number, peak: number, hp: number, lp = 0): void {
    const ctx = this.ctx;
    const dest = this.dest();
    if (!ctx || !dest || !this.noise || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = hp;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(high);
    if (lp > 0) {
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = lp;
      high.connect(low);
      low.connect(gain);
    } else {
      high.connect(gain);
    }
    gain.connect(dest);
    src.start();
    src.stop(ctx.currentTime + duration);
    src.onended = () => {
      src.disconnect();
      high.disconnect();
      gain.disconnect();
    };
  }

  click(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "square", 1180, 0.045, 0.06);
    this.noiseBurst(0.04, 0.05, 2400, 7000);
  }

  chip(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "triangle", 1640, 0.07, 0.08);
    this.env(dest, "sine", 820, 0.09, 0.05);
  }

  start(): void {
    const dest = this.dest();
    if (!dest) return;
    this.noiseBurst(0.12, 0.1, 400, 1800);
    this.env(dest, "sawtooth", 90, 0.16, 0.12, 40);
    this.env(dest, "square", 220, 0.08, 0.05);
  }

  stopSlam(): void {
    const dest = this.dest();
    if (!dest) return;
    this.noiseBurst(0.1, 0.14, 200, 1200);
    this.env(dest, "triangle", 70, 0.14, 0.16);
    this.env(dest, "square", 140, 0.07, 0.07);
  }

  startDrone(fast = false): void {
    const ctx = this.ctx;
    const dest = this.dest("sfx");
    if (!ctx || !dest || this.muted) return;
    this.stopDrone();
    this.spinFast = fast;
    const nodes: AudioNode[] = [];
    const oscs: OscillatorNode[] = [];

    const whir = ctx.createOscillator();
    const whirGain = ctx.createGain();
    const whirLp = ctx.createBiquadFilter();
    whir.type = "sawtooth";
    whir.frequency.value = fast ? 78 : 54;
    whirLp.type = "lowpass";
    whirLp.frequency.value = 260;
    whirGain.gain.value = 0.055;
    whir.connect(whirLp);
    whirLp.connect(whirGain);
    whirGain.connect(dest);
    whir.start();
    oscs.push(whir);
    nodes.push(whirLp, whirGain);

    let src: AudioBufferSourceNode | undefined;
    if (this.noise) {
      src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      const ng = ctx.createGain();
      bp.type = "bandpass";
      bp.frequency.value = 1900;
      bp.Q.value = 2.6;
      ng.gain.value = 0.04;
      src.connect(bp);
      bp.connect(ng);
      ng.connect(dest);
      src.start();
      nodes.push(bp, ng);
    }

    this.drone = { nodes, oscs, src };
    const tick = () => {
      if (!this.drone) return;
      this.noiseBurst(0.035, fast ? 0.09 : 0.07, 1600, 5000);
      this.env(dest, "square", fast ? 210 : 170, 0.028, 0.035);
      this.spinTickTimer = window.setTimeout(tick, fast ? 42 : 68);
    };
    tick();
  }

  stopDrone(): void {
    window.clearTimeout(this.spinTickTimer);
    const bits = this.drone;
    this.drone = null;
    if (!bits) return;
    for (const osc of bits.oscs) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
      osc.disconnect();
    }
    try {
      bits.src?.stop();
    } catch {
      /* already stopped */
    }
    bits.src?.disconnect();
    for (const n of bits.nodes) n.disconnect();
  }

  reelStop(index: number): void {
    const dest = this.dest();
    if (!dest) return;
    this.noiseBurst(0.07, 0.11, 300, 1600);
    this.env(dest, "triangle", 160 + index * 42, 0.11, 0.17);
    this.env(dest, "square", 72 + index * 8, 0.08, 0.09);
  }

  tick(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "sine", 980, 0.06, 0.06);
  }

  coin(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "triangle", 1560, 0.07, 0.07);
    this.env(dest, "sine", 980, 0.09, 0.05);
  }

  tally(ms: number): void {
    const n = Math.min(16, Math.max(3, Math.round(ms / 95)));
    const step = ms / n;
    for (let i = 0; i < n; i++) {
      window.setTimeout(() => this.coin(), i * step);
    }
  }

  cash(): void {
    const dest = this.dest();
    if (!dest) return;
    this.noiseBurst(0.18, 0.08, 800, 4000);
    [523, 659, 784, 1046].forEach((n, i) => {
      window.setTimeout(() => this.env(dest, "triangle", n, 0.22, 0.12), i * 70);
    });
  }

  scatter(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "sine", 660, 0.28, 0.14, 420);
    this.env(dest, "triangle", 990, 0.38, 0.1);
    this.env(dest, "sine", 1320, 0.45, 0.07);
  }

  book(): void {
    this.scatter();
  }

  bookOpen(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "sine", 180, 0.55, 0.12, 90);
    this.env(dest, "triangle", 420, 0.28, 0.1);
    this.noiseBurst(0.2, 0.08, 900, 3500);
    window.setTimeout(() => this.page(), 180);
    window.setTimeout(() => this.page(), 420);
    window.setTimeout(() => this.page(), 700);
    window.setTimeout(() => this.page(), 980);
    window.setTimeout(() => {
      this.env(dest, "sine", 880, 0.9, 0.14, 220);
      this.env(dest, "triangle", 1320, 0.7, 0.08);
    }, 1500);
  }

  page(): void {
    this.noiseBurst(0.11, 0.09, 1800, 6500);
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "triangle", 720, 0.08, 0.04, 420);
  }

  whoosh(): void {
    const dest = this.dest();
    if (!dest) return;
    this.noiseBurst(0.7, 0.16, 200, 2400);
    this.env(dest, "sine", 980, 1.05, 0.12, 140);
    this.env(dest, "triangle", 1960, 0.8, 0.06, 400);
  }

  enter(): void {
    const dest = this.dest("music");
    if (!dest) return;
    this.whoosh();
    [146, 220, 294, 440].forEach((n, i) => {
      window.setTimeout(() => this.env(dest, "sine", n, 0.55, 0.1), i * 160);
    });
  }

  startTombTheme(): void {
    if (this.tombOn) return;
    const ctx = this.ctx;
    const dest = this.dest("music");
    if (!ctx || !dest || this.muted) return;
    this.tombOn = true;
    this.tombStep = 0;
    const keep = (freq: number, peak: number, type: OscillatorType) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      this.tombKeep.push({ osc, gain });
    };
    keep(73.4, 0.055, "sine");
    keep(110, 0.03, "triangle");
    keep(146.8, 0.022, "sine");
    this.tickTomb();
  }

  stopTombTheme(): void {
    this.tombOn = false;
    window.clearTimeout(this.tombTimer);
    const ctx = this.ctx;
    for (const { osc, gain } of this.tombKeep) {
      try {
        if (ctx) gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
        osc.stop((ctx?.currentTime ?? 0) + 0.4);
      } catch {
        /* already stopped */
      }
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
    this.tombKeep = [];
  }

  private tickTomb(): void {
    if (!this.tombOn) return;
    const dest = this.dest("music");
    if (!dest) return;
    const melody = [294, 349, 392, 415, 392, 349, 294, 220, 262, 294, 349, 392, 440, 415, 349, 294];
    const n = melody[this.tombStep % melody.length] ?? 294;
    this.env(dest, "triangle", n, 0.62, 0.08);
    this.env(dest, "sine", n / 2, 0.8, 0.045);
    if (this.tombStep % 4 === 0) this.env(dest, "sine", n * 1.5, 0.9, 0.025);
    this.tombStep += 1;
    this.tombTimer = window.setTimeout(() => this.tickTomb(), 480);
  }

  win(tier: "small" | "great" | "mega" | "epic"): void {
    const dest = this.dest();
    if (!dest || !this.ctx) return;
    if (tier === "epic") {
      this.env(dest, "sine", 52, 1.4, 0.14);
      this.env(dest, "triangle", 78, 1.1, 0.08);
      const notes = [196, 247, 311, 392, 494, 587, 784, 988, 1174];
      notes.forEach((n, i) => {
        window.setTimeout(() => {
          this.env(dest, "triangle", n, 0.5, 0.17);
          this.env(dest, "sine", n * 2, 0.32, 0.07);
        }, i * 115);
      });
      return;
    }
    if (tier === "mega") {
      this.env(dest, "sine", 70, 0.9, 0.11);
      const notes = [262, 330, 392, 523, 659, 784];
      notes.forEach((n, i) => {
        window.setTimeout(() => this.env(dest, "triangle", n, 0.4, 0.16), i * 110);
      });
      return;
    }
    const notes = tier === "great" ? [330, 392, 494, 587] : [392, 494];
    notes.forEach((n, i) => {
      window.setTimeout(() => this.env(dest, "triangle", n, 0.28, 0.14), i * 90);
    });
  }

  bonus(): void {
    const dest = this.dest();
    if (!dest) return;
    [392, 494, 587, 784].forEach((n, i) => {
      window.setTimeout(() => this.env(dest, "sine", n, 0.4, 0.18), i * 140);
    });
  }

  pick(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "triangle", 784, 0.22, 0.12);
    this.env(dest, "sine", 1175, 0.3, 0.08);
    this.noiseBurst(0.08, 0.06, 1200, 4000);
  }

  gambleWin(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "triangle", 523, 0.2, 0.16);
    this.env(dest, "triangle", 784, 0.28, 0.14);
    this.coin();
  }

  gambleLose(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "sawtooth", 140, 0.35, 0.12, 90);
    this.noiseBurst(0.2, 0.08, 200, 900);
  }

  expand(): void {
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "sine", 240, 0.45, 0.14, 720);
    this.noiseBurst(0.16, 0.07, 700, 2800);
    window.setTimeout(() => this.noiseBurst(0.12, 0.06, 900, 3200), 180);
    window.setTimeout(() => this.noiseBurst(0.12, 0.05, 1100, 3600), 360);
  }

  card(): void {
    this.noiseBurst(0.09, 0.08, 1400, 5000);
    const dest = this.dest();
    if (!dest) return;
    this.env(dest, "triangle", 520, 0.1, 0.06, 280);
  }
}

export const audio = new SlotAudio();
