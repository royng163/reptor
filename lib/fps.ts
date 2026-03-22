import type { Keypoint, PoseResult } from '@royng163/reptor-core';

type State = {
  currentSrcTs: number;
  nextTargetTs: number;
  inputFrameTimestamps: number[];
  normalizedFrameTimestamps: number[];
  inputFps: number;
  normalizedFps: number;
};

const FPS_WINDOW_MS = 5000;

export class FpsNormalizer {
  private readonly targetIntervalMs: number;
  private state: State;

  constructor(targetFps = 30) {
    this.targetIntervalMs = 1000 / targetFps;
    this.state = {
      currentSrcTs: 0,
      nextTargetTs: 0,
      inputFrameTimestamps: [],
      normalizedFrameTimestamps: [],
      inputFps: 0,
      normalizedFps: 0,
    };
  }

  reset() {
    this.state = {
      currentSrcTs: 0,
      nextTargetTs: 0,
      inputFrameTimestamps: [],
      normalizedFrameTimestamps: [],
      inputFps: 0,
      normalizedFps: 0,
    };
  }

  getInputFps(): number {
    return this.state.inputFps;
  }

  getNormalizedFps(): number {
    return this.state.normalizedFps;
  }

  private updateInputFps(timestamp: number) {
    this.state.inputFrameTimestamps.push(timestamp);
    const cutoff = timestamp - FPS_WINDOW_MS;
    while (
      this.state.inputFrameTimestamps.length > 0 &&
      this.state.inputFrameTimestamps[0] < cutoff
    ) {
      this.state.inputFrameTimestamps.shift();
    }
    const windowDurationSec = (timestamp - this.state.inputFrameTimestamps[0]) / 1000;
    if (windowDurationSec > 0) {
      this.state.inputFps = this.state.inputFrameTimestamps.length / windowDurationSec;
    }
  }

  private updateNormalizedFps(timestamp: number) {
    this.state.normalizedFrameTimestamps.push(timestamp);
    const cutoff = timestamp - FPS_WINDOW_MS;
    while (
      this.state.normalizedFrameTimestamps.length > 0 &&
      this.state.normalizedFrameTimestamps[0] < cutoff
    ) {
      this.state.normalizedFrameTimestamps.shift();
    }
    const windowDurationSec = (timestamp - this.state.normalizedFrameTimestamps[0]) / 1000;
    if (windowDurationSec > 0) {
      this.state.normalizedFps = this.state.normalizedFrameTimestamps.length / windowDurationSec;
    }
  }

  /**
   * Input: one source inference sample (irregular FPS)
   * Output: 0..N samples at normalized target FPS
   */
  push(keypoints: Keypoint[], sourceTimestampMs: number): PoseResult[] {
    this.updateInputFps(sourceTimestampMs);

    if (this.state.currentSrcTs == 0) {
      this.state.currentSrcTs = sourceTimestampMs;
      this.state.nextTargetTs = sourceTimestampMs;
      this.updateNormalizedFps(Math.floor(sourceTimestampMs));
      return [{ timestamp: Math.floor(sourceTimestampMs), keypoints }];
    }

    const frameDurationMs = Math.max(1, sourceTimestampMs - this.state.currentSrcTs);
    const frameEndTs = this.state.currentSrcTs + frameDurationMs;
    const out: PoseResult[] = [];

    while (this.state.nextTargetTs < frameEndTs) {
      const ts = Math.floor(this.state.nextTargetTs);
      out.push({ timestamp: ts, keypoints });
      this.updateNormalizedFps(ts);
      this.state.nextTargetTs += this.targetIntervalMs;
    }

    this.state.currentSrcTs += frameDurationMs;
    return out;
  }
}
