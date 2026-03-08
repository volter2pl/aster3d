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
