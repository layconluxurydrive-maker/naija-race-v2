export class RacingAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private screechGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private muted = false;
  private volume = 0.7;
  private initialized = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    this.applyMasterGain();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : 0.45 * this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.45 * this.volume;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Dual-oscillator sport engine synthesis
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 2.4;

    const engGain = ctx.createGain();
    engGain.gain.value = 0.0;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 58;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 116;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(engGain);
    engGain.connect(master);

    osc1.start();
    osc2.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = engGain;

    // White noise buffer for tire screech & nitro boost whoosh
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Tire screech bandpass
    const screechSource = ctx.createBufferSource();
    screechSource.buffer = noiseBuffer;
    screechSource.loop = true;

    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 1350;
    screechFilter.Q.value = 6.5;

    const screechGain = ctx.createGain();
    screechGain.gain.value = 0;

    screechSource.connect(screechFilter);
    screechFilter.connect(screechGain);
    screechGain.connect(master);
    screechSource.start();
    this.screechGain = screechGain;

    // Nitro whoosh bandpass
    const boostSource = ctx.createBufferSource();
    boostSource.buffer = noiseBuffer;
    boostSource.loop = true;

    const boostFilter = ctx.createBiquadFilter();
    boostFilter.type = 'bandpass';
    boostFilter.frequency.value = 520;
    boostFilter.Q.value = 1.6;

    const boostGain = ctx.createGain();
    boostGain.gain.value = 0;

    boostSource.connect(boostFilter);
    boostFilter.connect(boostGain);
    boostGain.connect(master);
    boostSource.start();
    this.boostGain = boostGain;

    this.initialized = true;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  public updateEngine(speedRatio: number, rpmRatio: number, isDrifting: boolean, isBoosting: boolean, active: boolean): void {
    if (!this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain || !this.screechGain || !this.boostGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const baseFreq = 52 + rpmRatio * 145 + (isBoosting ? 24 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(240 + rpmRatio * 950 + (isBoosting ? 450 : 0), now, 0.06);
    this.engineGain.gain.setTargetAtTime(active ? 0.14 + speedRatio * 0.1 : 0.04, now, 0.08);

    const targetScreech = active && isDrifting && speedRatio > 0.2 ? Math.min(0.16, speedRatio * 0.18) : 0;
    this.screechGain.gain.setTargetAtTime(targetScreech, now, 0.06);

    const targetBoost = active && isBoosting ? 0.22 : 0;
    this.boostGain.gain.setTargetAtTime(targetBoost, now, 0.06);
  }

  public playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.22): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playCountdownBeep(isGo: boolean): void {
    this.playTone(isGo ? 880 : 440, isGo ? 0.35 : 0.16, 'triangle', isGo ? 0.28 : 0.2);
  }

  public playLapChime(): void {
    this.playTone(660, 0.14, 'triangle', 0.2);
    window.setTimeout(() => this.playTone(880, 0.24, 'triangle', 0.22), 110);
  }

  public playFinishFanfare(): void {
    this.playTone(523.25, 0.16, 'triangle', 0.22);
    window.setTimeout(() => this.playTone(659.25, 0.16, 'triangle', 0.22), 130);
    window.setTimeout(() => this.playTone(783.99, 0.18, 'triangle', 0.22), 260);
    window.setTimeout(() => this.playTone(1046.5, 0.42, 'triangle', 0.26), 390);
  }

  public playOpponentFinishChime(): void {
    this.playTone(587.33, 0.12, 'triangle', 0.16);
    window.setTimeout(() => this.playTone(740.0, 0.16, 'triangle', 0.18), 100);
  }

  public playGameOverTone(): void {
    this.playTone(392.0, 0.18, 'sawtooth', 0.16);
    window.setTimeout(() => this.playTone(311.13, 0.2, 'sawtooth', 0.16), 170);
    window.setTimeout(() => this.playTone(233.08, 0.45, 'sawtooth', 0.18), 350);
  }

  public playNairaCollect(): void {
    this.playTone(987.77, 0.08, 'sine', 0.18);
    window.setTimeout(() => this.playTone(1318.51, 0.16, 'triangle', 0.2), 60);
  }

  public playPurchaseSuccess(): void {
    this.playTone(587.33, 0.12, 'triangle', 0.22);
    window.setTimeout(() => this.playTone(739.99, 0.12, 'triangle', 0.22), 90);
    window.setTimeout(() => this.playTone(880.0, 0.14, 'triangle', 0.22), 180);
    window.setTimeout(() => this.playTone(1174.66, 0.34, 'triangle', 0.26), 270);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
