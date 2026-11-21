import { describe, expect, it, vi } from "vitest";
import type { Typing } from "../bridge/generated/protocol";
import { PITCH_SPREAD, SoundEngine, type AudioContextLike } from "./engine";
import { TYPING_SOUNDS } from "./typing-sounds";

/** A Web Audio stand-in that records what was asked of it. */
function fakeAudio() {
  const sources: { url: string; rate: number; started: boolean }[] = [];
  const gains: { value: number; targets: number[] }[] = [];
  let state: AudioContextState = "suspended";
  const context = {
    currentTime: 0,
    get state() {
      return state;
    },
    destination: {} as AudioDestinationNode,
    resume: vi.fn(() => {
      state = "running";
      return Promise.resolve();
    }),
    createGain: () => {
      const gain = { value: 1, targets: [] as number[] };
      gains.push(gain);
      return {
        gain: {
          get value() {
            return gain.value;
          },
          set value(next: number) {
            gain.value = next;
          },
          setTargetAtTime: (target: number) => gain.targets.push(target),
        },
        connect: vi.fn(),
      } as unknown as GainNode;
    },
    createBufferSource: () => {
      const source = { url: "", rate: 1, started: false };
      sources.push(source);
      return {
        set buffer(buffer: { url: string }) {
          source.url = buffer.url;
        },
        playbackRate: {
          set value(rate: number) {
            source.rate = rate;
          },
        },
        connect: vi.fn(),
        start: () => (source.started = true),
      } as unknown as AudioBufferSourceNode;
    },
    decodeAudioData: (bytes: ArrayBuffer) =>
      Promise.resolve({ url: new TextDecoder().decode(bytes) } as unknown as AudioBuffer),
  } as unknown as AudioContextLike;
  return { context, sources, gains };
}

const settle = () => new Promise((done) => setTimeout(done, 0));

function engine(random = () => 0.5, failing: string[] = []) {
  const audio = fakeAudio();
  const createContext = vi.fn(() => audio.context);
  const load = vi.fn((url: string) =>
    failing.includes(url)
      ? Promise.reject(new Error("404"))
      : Promise.resolve(new TextEncoder().encode(url).buffer as ArrayBuffer),
  );
  return { sound: new SoundEngine({ createContext, load, random }), audio, createContext, load };
}

const typewriter: Typing = { sound: "typewriter", volume: 0.6, muted: false };

describe("the sound engine", () => {
  it("does not touch the audio of the system while the typing is silent", () => {
    const { sound, createContext } = engine();

    sound.setTyping({ ...typewriter, muted: true });
    sound.play("key");

    expect(createContext).not.toHaveBeenCalled();
  });

  it("loads every sample of the chosen sound once, and sets its volume", async () => {
    const { sound, audio, load } = engine();

    sound.setTyping(typewriter);
    sound.setTyping(typewriter);
    await settle();

    const samples = TYPING_SOUNDS.typewriter;
    expect(load).toHaveBeenCalledTimes(samples.keys.length + 3);
    expect(audio.gains[0]?.targets.at(-1)).toBe(0.6);
  });

  it("sounds a key, wakes the audio on the first one, and varies its pitch a little", async () => {
    const { sound, audio } = engine(() => 0.99);
    sound.setTyping(typewriter);

    sound.play("key");
    await settle();

    expect(audio.context.resume).toHaveBeenCalledOnce();
    const [played] = audio.sources;
    expect(played?.started).toBe(true);
    expect(TYPING_SOUNDS.typewriter.keys).toContain(played?.url);
    expect(played?.rate).toBeGreaterThan(1);
    expect(played?.rate).toBeLessThanOrEqual(1 + PITCH_SPREAD);
  });

  it("gives Enter, erasing and the bell their own sounds, at their own pitch", async () => {
    const { sound, audio } = engine();
    sound.setTyping(typewriter);

    sound.play("enter");
    sound.play("backspace");
    sound.play("bell");
    await settle();

    const samples = TYPING_SOUNDS.typewriter;
    expect(audio.sources.map((source) => source.url)).toEqual([
      samples.enter,
      samples.backspace,
      samples.bell,
    ]);
    expect(audio.sources.every((source) => source.rate === 1)).toBe(true);
  });

  it("has no bell but for the typewriter", async () => {
    const { sound, audio } = engine();
    sound.setTyping({ ...typewriter, sound: "quill" });

    sound.play("bell");
    await settle();

    expect(audio.sources).toHaveLength(0);
  });

  it("stays silent when muted, and fades to nothing", async () => {
    const { sound, audio } = engine();
    sound.setTyping(typewriter);

    sound.setTyping({ ...typewriter, muted: true });
    sound.play("key");
    await settle();

    expect(audio.sources).toHaveLength(0);
    expect(audio.gains[0]?.targets.at(-1)).toBe(0);
  });

  it("lets a sample that will not load stay silent, and typing go on", async () => {
    const samples = TYPING_SOUNDS.mechanical;
    const { sound, audio } = engine(() => 0, [samples.keys[0]!]);
    sound.setTyping({ ...typewriter, sound: "mechanical" });

    sound.play("key");
    sound.play("enter");
    await settle();

    expect(audio.sources.map((source) => source.url)).toEqual([samples.enter]);
  });
});
