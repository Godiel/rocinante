import { describe, expect, it } from "vitest";
import {
  AmbientLoop,
  CROSSFADE_SECONDS,
  FADE_OUT_SECONDS,
  LOOKAHEAD_SECONDS,
  type LoopContext,
  type Timers,
} from "./ambient-loop";

type Event = [kind: string, value: number, at: number];

/** A context whose clock the test moves, recording every gain change and every round played. */
function fakeContext() {
  let time = 0;
  const rounds: { start: number; stop: number[]; envelope: Event[] }[] = [];
  const levels: Event[][] = [];
  const gain = (events: Event[]) =>
    ({
      gain: {
        set value(value: number) {
          events.push(["value", value, time]);
        },
        setValueAtTime: (value: number, at: number) => events.push(["set", value, at]),
        linearRampToValueAtTime: (value: number, at: number) => events.push(["ramp", value, at]),
        setTargetAtTime: (value: number, at: number) => events.push(["target", value, at]),
      },
      connect: () => {},
      disconnect: () => {},
    }) as unknown as GainNode;
  let lastEnvelope: Event[] = [];
  let firstGain = true;
  const context: LoopContext = {
    get currentTime() {
      return time;
    },
    createGain: () => {
      const events: Event[] = [];
      if (firstGain) {
        firstGain = false;
        levels.push(events);
      } else {
        lastEnvelope = events;
      }
      return gain(events);
    },
    createBufferSource: () => {
      const round = { start: -1, stop: [] as number[], envelope: lastEnvelope };
      rounds.push(round);
      return {
        connect: () => {},
        start: (at: number) => (round.start = at),
        stop: (at: number) => round.stop.push(at),
        set buffer(_: AudioBuffer) {},
        set onended(_: () => void) {},
      } as unknown as AudioBufferSourceNode;
    },
  };
  return {
    context,
    rounds,
    level: () => levels[0]!,
    advance(seconds: number) {
      time += seconds;
    },
  };
}

/** Timers the test runs by hand, at the context's clock. */
function fakeTimers() {
  const pending = new Map<number, { run: () => void; due: number }>();
  let next = 1;
  const timers: Timers = {
    later: (run, milliseconds) => {
      pending.set(next, { run, due: milliseconds });
      return next++;
    },
    cancel: (handle) => void pending.delete(handle),
  };
  return {
    timers,
    pending,
    /** Runs the one waiting timer, as its time would come. */
    fire() {
      const [handle, timer] = [...pending][0]!;
      pending.delete(handle);
      timer.run();
      return timer.due;
    },
  };
}

const recording = (duration: number) => ({ duration }) as AudioBuffer;
const output = {} as AudioNode;
/** Starts a loop that the test only listens to. */
const play = (...args: ConstructorParameters<typeof AmbientLoop>) => new AmbientLoop(...args);

describe("an ambient loop", () => {
  it("starts at once, fading in, and fades out at the end of the round", () => {
    const audio = fakeContext();
    const { timers } = fakeTimers();

    play(audio.context, recording(20), output, 0.7, timers);

    const [round] = audio.rounds;
    expect(round?.start).toBe(0);
    expect(round?.stop).toEqual([20]);
    expect(round?.envelope).toEqual([
      ["set", 0, 0],
      ["ramp", 1, CROSSFADE_SECONDS],
      ["set", 1, 20 - CROSSFADE_SECONDS],
      ["ramp", 0, 20],
    ]);
    expect(audio.level()).toEqual([["value", 0.7, 0]]);
  });

  it("starts the next round as the last one fades, so the seam is never heard", () => {
    const audio = fakeContext();
    const clock = fakeTimers();
    play(audio.context, recording(20), output, 1, clock.timers);

    const wait = clock.fire();

    expect(wait).toBe((20 - CROSSFADE_SECONDS - LOOKAHEAD_SECONDS) * 1000);
    expect(audio.rounds[1]?.start).toBe(20 - CROSSFADE_SECONDS);
    expect(audio.rounds[1]?.envelope[1]).toEqual(["ramp", 1, 20]);
    expect(clock.pending.size).toBe(1);
  });

  it("keeps the overlap within a short recording", () => {
    const audio = fakeContext();
    play(audio.context, recording(4), output, 1, fakeTimers().timers);

    expect(audio.rounds[0]?.envelope[1]).toEqual(["ramp", 1, 1]);
  });

  it("follows a new level, and fades away when stopped, setting up nothing more", () => {
    const audio = fakeContext();
    const clock = fakeTimers();
    const loop = new AmbientLoop(audio.context, recording(20), output, 0.7, clock.timers);
    audio.advance(5);

    loop.setLevel(0.2);
    loop.stop();

    expect(audio.level().slice(1)).toEqual([
      ["target", 0.2, 5],
      ["target", 0, 5],
    ]);
    expect(audio.rounds[0]?.stop).toEqual([20, 5 + FADE_OUT_SECONDS]);
    expect(clock.pending.size).toBe(0);
  });
});
