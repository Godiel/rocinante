/** How long the end of a loop and its new beginning overlap. */
export const CROSSFADE_SECONDS = 3;
/** How early the next round of a loop is set up, before the current one starts to fade. */
export const LOOKAHEAD_SECONDS = 1.5;
/** How long an ambient takes to fade away when it leaves the mix or the work closes. */
export const FADE_OUT_SECONDS = 0.6;

/** What a loop needs from the audio context; the engine's context, or a fake in tests. */
export interface LoopContext {
  readonly currentTime: number;
  createGain(): GainNode;
  createBufferSource(): AudioBufferSourceNode;
}

/** When to come back to set up the next round; setTimeout in the app, a fake clock in tests. */
export interface Timers {
  later(run: () => void, milliseconds: number): number;
  cancel(handle: number): void;
}

const browserTimers: Timers = {
  later: (run, milliseconds) => window.setTimeout(run, milliseconds),
  cancel: (handle) => window.clearTimeout(handle),
};

/**
 * One ambient sound playing for as long as it is wanted. Each round of the recording fades in
 * while the last one fades out, so the seam is never heard, whatever silence or click the file
 * has at its ends. Only the current round and the next exist at a time.
 */
export class AmbientLoop {
  private readonly level: GainNode;
  private readonly rounds = new Set<AudioBufferSourceNode>();
  private readonly overlap: number;
  private timer: number | null = null;
  private stopped = false;
  private readonly context: LoopContext;
  private readonly buffer: AudioBuffer;
  private readonly timers: Timers;

  constructor(
    context: LoopContext,
    buffer: AudioBuffer,
    output: AudioNode,
    level: number,
    timers: Timers = browserTimers,
  ) {
    this.context = context;
    this.buffer = buffer;
    this.timers = timers;
    this.overlap = Math.min(CROSSFADE_SECONDS, buffer.duration / 4);
    this.level = context.createGain();
    this.level.gain.value = level;
    this.level.connect(output);
    this.round(context.currentTime);
  }

  /** Moves to another level smoothly. */
  setLevel(level: number): void {
    this.level.gain.setTargetAtTime(level, this.context.currentTime, 0.03);
  }

  /** Fades away and lets go of everything. */
  stop(fade = FADE_OUT_SECONDS): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) this.timers.cancel(this.timer);
    const now = this.context.currentTime;
    this.level.gain.setTargetAtTime(0, now, fade / 4);
    for (const round of this.rounds) round.stop(now + fade);
  }

  /** One round of the recording from `at`, fading in, and the next one set up to overlap it. */
  private round(at: number): void {
    if (this.stopped) return;
    const { duration } = this.buffer;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(1, at + this.overlap);
    envelope.gain.setValueAtTime(1, at + duration - this.overlap);
    envelope.gain.linearRampToValueAtTime(0, at + duration);
    envelope.connect(this.level);

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(envelope);
    source.onended = () => {
      this.rounds.delete(source);
      envelope.disconnect();
    };
    source.start(at);
    source.stop(at + duration);
    this.rounds.add(source);

    const next = at + duration - this.overlap;
    const wait = Math.max(0, next - LOOKAHEAD_SECONDS - this.context.currentTime) * 1000;
    this.timer = this.timers.later(() => this.round(next), wait);
  }
}
