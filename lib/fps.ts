import type { Landmark, PoseResult } from '../services/evaluation/poseInference';

type State = {
  currentSrcTs: number;
  nextTargetTs: number;
  frameCount: number;
  fpsStartTs: number;
  inputFps: number;
  normalizedFrameCount: number;
  normalizedFpsStartTs: number;
  normalizedFps: number;
};

export class FpsNormalizer {
  private readonly targetIntervalMs: number;
  private state: State;

  constructor(targetFps = 30) {
    this.targetIntervalMs = 1000 / targetFps;
    this.state = {
      currentSrcTs: 0,
      nextTargetTs: 0,
      frameCount: 0,
      fpsStartTs: 0,
      inputFps: 0,
      normalizedFrameCount: 0,
      normalizedFpsStartTs: 0,
      normalizedFps: 0,
    };
  }

  reset() {
    this.state = {
      currentSrcTs: 0,
      nextTargetTs: 0,
      frameCount: 0,
      fpsStartTs: 0,
      inputFps: 0,
      normalizedFrameCount: 0,
      normalizedFpsStartTs: 0,
      normalizedFps: 0,
    };
  }

  getInputFps(): number {
    return this.state.inputFps;
  }

  getNormalizedFps(): number {
    return this.state.normalizedFps;
  }

  /**
   * Input: one source inference sample (irregular FPS)
   * Output: 0..N samples at normalized target FPS
   */
  push(landmarks: Landmark[], sourceTimestampMs: number): PoseResult[] {
    // Input FPS calculation
    this.state.frameCount += 1;
    if (this.state.fpsStartTs == 0) {
      this.state.fpsStartTs = sourceTimestampMs;
    } else {
      const elapsedSec = (sourceTimestampMs - this.state.fpsStartTs) / 1000;
      if (elapsedSec > 0) {
        this.state.inputFps = this.state.frameCount / elapsedSec;
      }
    }

    // Initialization on first frame
    if (this.state.currentSrcTs == 0) {
      this.state.currentSrcTs = sourceTimestampMs;
      this.state.nextTargetTs = sourceTimestampMs;

      this.state.normalizedFrameCount += 1;
      if (this.state.normalizedFpsStartTs === 0)
        this.state.normalizedFpsStartTs = sourceTimestampMs;

      return [{ timestamp: Math.floor(sourceTimestampMs), landmarks }];
    }

    const frameDurationMs = Math.max(1, sourceTimestampMs - this.state.currentSrcTs);
    const frameEndTs = this.state.currentSrcTs + frameDurationMs;
    const out: PoseResult[] = [];

    // Downsample when source FPS > target FPS
    // Duplicate when source FPS < target FPS
    while (this.state.nextTargetTs < frameEndTs) {
      const ts = Math.floor(this.state.nextTargetTs);
      out.push({ timestamp: ts, landmarks });

      // normalized FPS
      this.state.normalizedFrameCount += 1;
      if (this.state.normalizedFpsStartTs === 0) {
        this.state.normalizedFpsStartTs = ts;
      } else {
        const elapsedSec = (ts - this.state.normalizedFpsStartTs) / 1000;
        if (elapsedSec > 0) {
          this.state.normalizedFps = this.state.normalizedFrameCount / elapsedSec;
        }
      }

      this.state.nextTargetTs += this.targetIntervalMs;
    }

    this.state.currentSrcTs += frameDurationMs;
    return out;
  }
}
