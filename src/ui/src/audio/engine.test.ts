import { describe, expect, it, vi } from "vitest";
import type { Typing } from "../bridge/generated/protocol";
import { PITCH_SPREAD, SoundEngine, type AudioContextLike } from "./engine";
import { TYPING_SOUNDS } from "./typing-sounds";

/** A Web Audio stand-in that records what was asked of it. */
function fakeAudio() {
  const sources: { url: string; rate: number; started: boolean; stopped: number[] }[] = [];
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
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as GainNode;
    },
    createBufferSource: () => {
      const source = { url: "", rate: 1, started: false, stopped: [] as number[] };
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
        stop: (at: number) => source.stopped.push(at),
        set onended(_: () => void) {},
      } as unknown as AudioBufferSourceNode;
    },
    decodeAudioData: (bytes: ArrayBuffer) =>
      Promise.resolve({
        url: new TextDecoder().decode(bytes),
        duration: 20,
      } as unknown as AudioBuffer),
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
  // The next rounds of the loops are not the engine's business: the loop's own tests cover them.
  const timers = { later: () => 0, cancel: () => {} };
  return {
    sound: new SoundEngine({ createContext, load, random, timers }),
    audio,
    createContext,
    load,
  };
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

describe("the ambient sounds", () => {
  const rain = { id: "builtin:rain", url: "/sounds/ambient/rain.ogg", level: 0.8 };
  const fire = { id: "builtin:fire", url: "/sounds/ambient/fire.ogg", level: 0.4 };
  // The second gain the engine makes is the one of the ambients.
  const ambientVolume = (audio: ReturnType<typeof fakeAudio>) => audio.gains[1]!.targets.at(-1);

  it("leave the audio of the system alone while there are none", () => {
    const { sound, createContext } = engine();

    sound.setAmbients([], 0.5, false);
    sound.stopAmbients();

    expect(createContext).not.toHaveBeenCalled();
  });

  it("play every ambient of the mix, at the volume of the ambients", async () => {
    const { sound, audio } = engine();

    sound.setAmbients([rain, fire], 0.5, false);
    await settle();

    expect(audio.sources.map((source) => source.url)).toEqual([rain.url, fire.url]);
    expect(ambientVolume(audio)).toBe(0.5);
  });

  it("fall silent when muted, without stopping", async () => {
    const { sound, audio } = engine();
    sound.setAmbients([rain], 0.5, false);
    await settle();

    sound.setAmbients([rain], 0.5, true);

    expect(ambientVolume(audio)).toBe(0);
    expect(audio.sources[0]?.stopped).toEqual([20]);
  });

  it("follow a level without loading again, and let go of one that leaves", async () => {
    const { sound, audio, load } = engine();
    sound.setAmbients([rain, fire], 0.5, false);
    await settle();

    sound.setAmbients([{ ...rain, level: 0.2 }], 0.5, false);
    await settle();

    expect(load).toHaveBeenCalledTimes(2);
    expect(audio.sources[1]?.stopped.length).toBe(2);
    expect(audio.sources[0]?.stopped).toEqual([20]);

    sound.setAmbients([{ ...rain, level: 0.2 }, fire], 0.5, false);
    await settle();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("do not start one that left before its recording arrived", async () => {
    const { sound, audio } = engine();

    sound.setAmbients([rain], 0.5, false);
    sound.setAmbients([], 0.5, false);
    await settle();

    expect(audio.sources).toHaveLength(0);
  });

  it("fade away when the work closes", async () => {
    const { sound, audio } = engine();
    sound.setAmbients([rain, fire], 0.5, false);
    await settle();

    sound.stopAmbients();

    expect(audio.sources.every((source) => source.stopped.length === 2)).toBe(true);
    expect(ambientVolume(audio)).toBe(0);
  });
});

describe("an ambient that cannot be played", () => {
  it("is said once, and the others play", async () => {
    const broken = {
      id: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
      url: "ambience://localhost/roto.ogg",
      level: 1,
    };
    const rain = { id: "builtin:rain", url: "/sounds/ambient/rain.ogg", level: 1 };
    const { sound, audio } = engine(() => 0.5, [broken.url]);
    const heard: string[] = [];
    const stop = sound.onUnplayable((id) => heard.push(id));

    sound.setAmbients([broken, rain], 1, false);
    await settle();
    stop();
    sound.setAmbients([rain], 1, false);
    sound.setAmbients([broken, rain], 1, false);
    await settle();

    expect(heard).toEqual([broken.id]);
    expect(audio.sources.map((source) => source.url)).toEqual([rain.url]);
  });
});
