type Envelope = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  peak: number;
};

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private boostBody: OscillatorNode | null = null;
  private boostBodyGain: GainNode | null = null;
  private boostAir: OscillatorNode | null = null;
  private boostAirGain: GainNode | null = null;
  private boostCleanupTimer: number | null = null;

  public async resume(): Promise<void> {
    const context = this.ensureContext();
    if (context.state !== "running") {
      await context.resume();
    }
  }

  public playShot(): void {
    const context = this.ensureContext();
    if (context.state !== "running" || !this.master) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(820, now);
    oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.09);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.value = 1.4;

    this.applyEnvelope(gain, now, {
      attack: 0.002,
      decay: 0.04,
      sustain: 0.2,
      release: 0.05,
      peak: 0.09,
    });

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    oscillator.start(now);
    oscillator.stop(now + 0.11);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  public playEnemyShot(): void {
    const context = this.ensureContext();
    if (context.state !== "running" || !this.master) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(260, now);
    oscillator.frequency.exponentialRampToValueAtTime(130, now + 0.16);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(760, now);
    filter.Q.value = 0.9;

    this.applyEnvelope(gain, now, {
      attack: 0.002,
      decay: 0.05,
      sustain: 0.22,
      release: 0.08,
      peak: 0.055,
    });

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    oscillator.start(now);
    oscillator.stop(now + 0.18);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  public playExplosion(intensity: number): void {
    const context = this.ensureContext();
    if (context.state !== "running" || !this.master || !this.noiseBuffer) {
      return;
    }

    const now = context.currentTime;
    const clippedIntensity = clamp(intensity, 0.5, 1.8);

    const noise = context.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(520 * clippedIntensity, now);
    noiseFilter.Q.value = 0.7;

    const noiseGain = context.createGain();
    this.applyEnvelope(noiseGain, now, {
      attack: 0.001,
      decay: 0.16,
      sustain: 0.15,
      release: 0.2,
      peak: 0.16 * clippedIntensity,
    });

    const boomOscillator = context.createOscillator();
    boomOscillator.type = "triangle";
    boomOscillator.frequency.setValueAtTime(140 * clippedIntensity, now);
    boomOscillator.frequency.exponentialRampToValueAtTime(38, now + 0.28);

    const boomGain = context.createGain();
    this.applyEnvelope(boomGain, now, {
      attack: 0.001,
      decay: 0.12,
      sustain: 0.18,
      release: 0.16,
      peak: 0.11 * clippedIntensity,
    });

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);

    boomOscillator.connect(boomGain);
    boomGain.connect(this.master);

    noise.start(now);
    noise.stop(now + 0.34);
    boomOscillator.start(now);
    boomOscillator.stop(now + 0.3);

    noise.onended = () => {
      noise.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    };

    boomOscillator.onended = () => {
      boomOscillator.disconnect();
      boomGain.disconnect();
    };
  }

  public playPickup(): void {
    const context = this.ensureContext();
    if (context.state !== "running" || !this.master) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(420, now);
    oscillator.frequency.linearRampToValueAtTime(620, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(860, now + 0.18);

    filter.type = "highpass";
    filter.frequency.setValueAtTime(500, now);
    filter.Q.value = 0.8;

    this.applyEnvelope(gain, now, {
      attack: 0.002,
      decay: 0.08,
      sustain: 0.28,
      release: 0.12,
      peak: 0.12,
    });

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    oscillator.start(now);
    oscillator.stop(now + 0.22);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  public setEngine(speedRatio: number, boostRatio: number): void {
    const context = this.ensureContext();
    if (context.state !== "running" || !this.master) {
      return;
    }

    const now = context.currentTime;
    const clampedSpeed = clamp(speedRatio, 0, 1);
    const clampedBoost = clamp(boostRatio, 0, 1);
    const intensity = Math.max(0, clampedSpeed * 0.85 + clampedBoost * 0.65);

    if (intensity > 0.03) {
      this.ensureBoostNodes(context);
      if (!this.boostFilter || !this.boostBody || !this.boostBodyGain || !this.boostAir || !this.boostAirGain) {
        return;
      }

      const bodyPitch = 104 + clampedSpeed * 68 + clampedBoost * 92;
      const airPitch = 190 + clampedSpeed * 120 + clampedBoost * 165;
      const filterCutoff = 720 + clampedSpeed * 900 + clampedBoost * 1350;
      const bodyGain = 0.014 + clampedSpeed * 0.028 + clampedBoost * 0.028;
      const airGain = 0.0015 + clampedSpeed * 0.004 + clampedBoost * 0.012;

      this.boostBody.frequency.cancelScheduledValues(now);
      this.boostBody.frequency.setTargetAtTime(bodyPitch, now, 0.06);
      this.boostAir.frequency.cancelScheduledValues(now);
      this.boostAir.frequency.setTargetAtTime(airPitch, now, 0.06);
      this.boostFilter.frequency.cancelScheduledValues(now);
      this.boostFilter.frequency.setTargetAtTime(filterCutoff, now, 0.08);

      this.boostBodyGain.gain.cancelScheduledValues(now);
      this.boostBodyGain.gain.setTargetAtTime(bodyGain, now, 0.04);
      this.boostAirGain.gain.cancelScheduledValues(now);
      this.boostAirGain.gain.setTargetAtTime(airGain, now, 0.05);
      return;
    }

    if (this.boostBodyGain && this.boostAirGain) {
      this.boostBodyGain.gain.cancelScheduledValues(now);
      this.boostAirGain.gain.cancelScheduledValues(now);
      this.boostBodyGain.gain.setTargetAtTime(0.0001, now, 0.025);
      this.boostAirGain.gain.setTargetAtTime(0.0001, now, 0.03);
      this.scheduleBoostCleanup();
    }
  }

  public dispose(): void {
    if (this.boostCleanupTimer !== null) {
      window.clearTimeout(this.boostCleanupTimer);
      this.boostCleanupTimer = null;
    }

    try {
      this.boostBody?.stop();
    } catch {
      // Ignored: oscillator may have already been stopped during cleanup.
    }

    try {
      this.boostAir?.stop();
    } catch {
      // Ignored: oscillator may have already been stopped during cleanup.
    }

    this.boostBody?.disconnect();
    this.boostBodyGain?.disconnect();
    this.boostAir?.disconnect();
    this.boostAirGain?.disconnect();
    this.boostFilter?.disconnect();
    this.master?.disconnect();

    this.boostFilter = null;
    this.boostBody = null;
    this.boostBodyGain = null;
    this.boostAir = null;
    this.boostAirGain = null;
    this.master = null;
    this.noiseBuffer = null;

    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => {
        // Closing can fail if the browser has already torn the context down.
      });
    }
  }

  private ensureContext(): AudioContext {
    if (this.context && this.master && this.noiseBuffer) {
      return this.context;
    }

    this.context = new window.AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer(this.context);
    return this.context;
  }

  private ensureBoostNodes(context: AudioContext): void {
    if (this.boostFilter && this.boostBody && this.boostBodyGain && this.boostAir && this.boostAirGain) {
      if (this.boostCleanupTimer !== null) {
        window.clearTimeout(this.boostCleanupTimer);
        this.boostCleanupTimer = null;
      }
      return;
    }

    if (this.boostCleanupTimer !== null) {
      window.clearTimeout(this.boostCleanupTimer);
      this.boostCleanupTimer = null;
    }

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 850;
    filter.Q.value = 0.35;

    const body = context.createOscillator();
    body.type = "triangle";
    body.frequency.value = 132;

    const bodyGain = context.createGain();
    bodyGain.gain.value = 0.0001;

    const air = context.createOscillator();
    air.type = "sine";
    air.frequency.value = 260;

    const airGain = context.createGain();
    airGain.gain.value = 0.0001;

    body.connect(bodyGain);
    bodyGain.connect(filter);

    air.connect(airGain);
    airGain.connect(filter);
    filter.connect(this.master!);

    body.start();
    air.start();

    this.boostFilter = filter;
    this.boostBody = body;
    this.boostBodyGain = bodyGain;
    this.boostAir = air;
    this.boostAirGain = airGain;
  }

  private scheduleBoostCleanup(): void {
    if (this.boostCleanupTimer !== null) {
      window.clearTimeout(this.boostCleanupTimer);
    }

    this.boostCleanupTimer = window.setTimeout(() => {
      this.boostCleanupTimer = null;

      this.boostBody?.stop();
      this.boostAir?.stop();
      this.boostBody?.disconnect();
      this.boostBodyGain?.disconnect();
      this.boostAir?.disconnect();
      this.boostAirGain?.disconnect();
      this.boostFilter?.disconnect();

      this.boostFilter = null;
      this.boostBody = null;
      this.boostBodyGain = null;
      this.boostAir = null;
      this.boostAirGain = null;
    }, 140);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 0.5);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  private applyEnvelope(gainNode: GainNode, startTime: number, envelope: Envelope): void {
    const sustainLevel = envelope.peak * envelope.sustain;
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(envelope.peak, startTime + envelope.attack);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + envelope.attack + envelope.decay);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      startTime + envelope.attack + envelope.decay + envelope.release,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
