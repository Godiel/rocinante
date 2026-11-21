import type { Typing } from "../bridge/generated/protocol";
import { TYPING_SOUNDS, type Stroke } from "./typing-sounds";

/** How long a change of volume takes: short enough to follow the hand, long enough not to click. */
export const RAMP_SECONDS = 0.1;
/** How far a key's pitch may stray, either way, so the same key never sounds twice alike. */
export const PITCH_SPREAD = 0.03;

/** The part of Web Audio the engine uses; tests give it a fake. */
export type AudioContextLike = Pick<
  AudioContext,
  "createGain" | "createBufferSource" | "decodeAudioData" | "destination" | "currentTime" | "state"
> & { resume(): Promise<void> };

interface Options {
  createContext(): AudioContextLike;
  load(url: string): Promise<ArrayBuffer>;
  random?: () => number;
}

/**
 * The app's sound: one audio context for every window, with a gain for the typing and another for
 * the ambient sounds. The context is created when sound is first needed and resumed on the
 * writer's first keystroke, as browsers ask. Every sample is decoded once and kept.
 */
export class SoundEngine {
  private context: AudioContextLike | null = null;
  private typingGain: GainNode | null = null;
  private typing: Typing | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly random: () => number;
  private readonly options: Options;

  constructor(options: Options) {
    this.options = options;
    this.random = options.random ?? Math.random;
  }

  /** The writer's typing sound changed: loads its samples and moves to its volume. */
  setTyping(typing: Typing): void {
    this.typing = typing;
    const audible = !typing.muted && typing.volume > 0;
    if (!audible && !this.context) return;
    const context = this.ready();
    this.typingGain!.gain.setTargetAtTime(
      audible ? typing.volume : 0,
      context.currentTime,
      RAMP_SECONDS / 3,
    );
    if (audible) {
      const samples = TYPING_SOUNDS[typing.sound];
      for (const url of [...samples.keys, samples.enter, samples.backspace, samples.bell]) {
        if (url) void this.buffer(url);
      }
    }
  }

  /** A keystroke that wrote something. Silent until its sample is decoded. */
  play(stroke: Stroke): void {
    const typing = this.typing;
    if (!typing || typing.muted || typing.volume === 0) return;
    const context = this.ready();
    if (context.state === "suspended") void context.resume();

    const samples = TYPING_SOUNDS[typing.sound];
    const url =
      stroke === "key"
        ? samples.keys[Math.floor(this.random() * samples.keys.length)]
        : stroke === "bell"
          ? samples.bell
          : samples[stroke];
    if (!url) return;
    const pitch = stroke === "key" ? 1 + (this.random() * 2 - 1) * PITCH_SPREAD : 1;

    void this.buffer(url).then((buffer) => {
      if (!buffer || !this.typingGain) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pitch;
      source.connect(this.typingGain);
      source.start();
    });
  }

  /** Lets the browser start sound: called on the writer's first keystroke. */
  wake(): void {
    if (this.context?.state === "suspended") void this.context.resume();
  }

  private ready(): AudioContextLike {
    if (!this.context) {
      this.context = this.options.createContext();
      this.typingGain = this.context.createGain();
      this.typingGain.gain.value = 0;
      this.typingGain.connect(this.context.destination);
    }
    return this.context;
  }

  private buffer(url: string): Promise<AudioBuffer | null> {
    let decoded = this.buffers.get(url);
    if (!decoded) {
      const context = this.ready();
      decoded = this.options
        .load(url)
        .then((bytes) => context.decodeAudioData(bytes))
        // A sample that will not load stays silent; typing goes on.
        .catch(() => null);
      this.buffers.set(url, decoded);
    }
    return decoded;
  }
}

/** The app's engine, over the window's Web Audio and the files served with the page. */
export const sounds = new SoundEngine({
  createContext: () => new AudioContext({ latencyHint: "interactive" }),
  load: (url) =>
    fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${response.status} for a sound`);
      return response.arrayBuffer();
    }),
});
