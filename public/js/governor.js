// Pure adaptive quality controller and per-room mode storage helpers.
// Zero imports and zero DOM/WebGL globals so Node unit tests and the browser run the exact same code.

export const STORAGE_PREFIX = 'arcadia:gov:v1:';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length & 1 ? s[mid] : (s[mid - 1] + s[mid]) * 0.5;
}

export function storageKey(roomId) {
  return `${STORAGE_PREFIX}${roomId}`;
}

/** Read a saved `{ tier, scale }` entry for `roomId` from `storage`, returning null on missing/corrupt/out-of-range data. */
export function loadRoomMode(storage, roomId, { min = 0.5, max = 1 } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof roomId !== 'string' || !roomId) return null;
  try {
    const raw = storage.getItem(storageKey(roomId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.v !== 1) return null;
    if (data.tier !== 0 && data.tier !== 1) return null;
    if (typeof data.scale !== 'number' || !Number.isFinite(data.scale)) return null;
    if (data.scale < min || data.scale > max) return null;
    return { tier: data.tier, scale: data.scale };
  } catch {
    return null;
  }
}

/** Persist `{ tier, scale }` for `roomId` into `storage`, guarding against SecurityError / quota failures. */
export function saveRoomMode(storage, roomId, mode, { min = 0.5, max = 1 } = {}) {
  if (!storage || typeof storage.setItem !== 'function' || typeof roomId !== 'string' || !roomId || !mode) return false;
  const tier = mode.tier === 1 ? 1 : mode.tier === 0 ? 0 : null;
  if (tier === null || typeof mode.scale !== 'number' || !Number.isFinite(mode.scale)) return false;
  const scale = Math.round(clamp(mode.scale, min, max) * 10000) / 10000;
  try {
    storage.setItem(storageKey(roomId), JSON.stringify({ v: 1, tier, scale }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamic quality controller: adjusts `tier` (0: 4x MSAA, 1: FXAA) and `scale` (render resolution factor)
 * from per-frame GPU timer samples when available, otherwise from unclamped frame intervals (`dtMs`).
 * Never disables reflections or alters mirror ratio (D10).
 */
export class Governor {
  constructor({
    min = 0.5,
    max = 1,
    target = 60,
    pinned = null,
    tierPinned = false,
    tier = 0,
    scale = null,
    hasGpuTimer = false,
  } = {}) {
    this.min = min;
    this.max = max;
    this.target = target;
    this.scalePinned = pinned != null;
    this.pinned = this.scalePinned;
    this.tierPinned = !!tierPinned;
    this.tier = tier ? 1 : 0;
    this.scale = this.scalePinned ? pinned : clamp(scale ?? max, min, max);
    this.hasGpuTimer = !!hasGpuTimer;

    this.frameBudget = 1000 / target;
    this.gpuSlow = this.frameBudget * 0.86;    // ~14.33 ms at 60 Hz: drive below vblank with margin while preserving 14 ms tier-1 GPUs
    this.gpuHoldSlow = this.frameBudget * 0.94; // ~15.67 ms at 60 Hz: hysteresis guard once settled
    this.gpuAim = this.frameBudget * 0.66;     // ~11.0 ms at 60 Hz: target headroom
    this.gpuFast = this.frameBudget * 0.56;    // ~9.33 ms at 60 Hz: upgrade threshold
    this.slow = 1000 / (target * 0.86);        // ~19.38 ms at 60 Hz: dt fallback slow threshold
    this.fast = 1000 / (target * 0.95);        // ~17.54 ms at 60 Hz: dt fallback fast threshold
    this.dtAim = this.frameBudget * 0.80;      // ~13.33 ms at 60 Hz: dt fallback target

    this.windowMs = 250;
    this.baseBackoffMs = 28000;
    this.maxBackoffMs = 120000;
    this.backoffMs = this.baseBackoffMs;
    this.downgradeCool = 0;
    this.upgradeCool = 0;
    this.settledMs = 0;
    this._goodMs = 0;
    this._sinceUpgrade = 1e9;
    this._slowDtStreak = 0;
    this._slowGpuStreak = 0;
    this._resetWindow();
    this.rest(250);
  }

  get allPinned() {
    return this.scalePinned && this.tierPinned;
  }

  _resetWindow() {
    this._winMs = 0;
    this._dtSum = 0;
    this._dtCount = 0;
    this._hadHitch = false;
    this._gpuSamples = [];
  }

  /** Ignore the next `ms` of frames while startup/room-change/calm transitions settle. */
  rest(ms) {
    this.warm = Math.max(0, ms);
    this._slowDtStreak = 0;
    this._slowGpuStreak = 0;
    this._resetWindow();
  }

  /** Reset controller state for a room entry (preserving URL query pins). */
  reset({ tier = 0, scale = this.max, warm = 250 } = {}) {
    if (!this.tierPinned) this.tier = tier ? 1 : 0;
    if (!this.scalePinned) this.scale = clamp(scale ?? this.max, this.min, this.max);
    this.downgradeCool = 0;
    this.backoffMs = this.baseBackoffMs;
    const restoredBelowMax = (!this.scalePinned && this.scale < this.max) || (!this.tierPinned && this.tier > 0);
    this.upgradeCool = restoredBelowMax ? this.backoffMs : 0;
    this._goodMs = 0;
    this._sinceUpgrade = 1e9;
    this.settledMs = 0;
    this.rest(warm);
  }

  /**
   * Feed one frame's unclamped `dtMs` and optional GPU ms sample(s).
   * @param {number} dtMs - unclamped frame interval in milliseconds
   * @param {number|number[]|null} [gpuSamples] - GPU render time sample(s) in milliseconds
   * @returns {boolean} true when `tier` or `scale` changed
   */
  update(dtMs, gpuSamples = null) {
    if (this.allPinned || !Number.isFinite(dtMs) || dtMs < 0) return false;
    if (dtMs > 1000) {
      // Tab switch or long OS pause: discard in-progress window and streaks without counting toward warm/cooldowns.
      this._slowDtStreak = 0;
      this._slowGpuStreak = 0;
      this._resetWindow();
      return false;
    }
    if (this.warm > 0) {
      this.warm = Math.max(0, this.warm - dtMs);
      return false;
    }

    this.settledMs += dtMs;
    if (this.upgradeCool > 0) this.upgradeCool = Math.max(0, this.upgradeCool - dtMs);
    if (this._sinceUpgrade < 1e9) this._sinceUpgrade += dtMs;

    if (this.downgradeCool > 0) {
      this.downgradeCool = Math.max(0, this.downgradeCool - dtMs);
      if (this.downgradeCool > 0) return false;
      this._resetWindow();
      return false;
    }

    this._winMs += dtMs;
    this._dtSum += dtMs;
    this._dtCount++;
    if (dtMs > 150) this._hadHitch = true;

    if (typeof gpuSamples === 'number') {
      if (Number.isFinite(gpuSamples) && gpuSamples > 0 && gpuSamples < 2000) this._gpuSamples.push(gpuSamples);
    } else if (Array.isArray(gpuSamples)) {
      for (const g of gpuSamples) {
        if (typeof g === 'number' && Number.isFinite(g) && g > 0 && g < 2000) this._gpuSamples.push(g);
      }
    }

    if (this._winMs < this.windowMs || this._dtCount < 3) return false;

    const winMs = this._winMs;
    const dtAvg = this._dtSum / this._dtCount;
    const hadHitch = this._hadHitch;
    const gpuMed = this._gpuSamples.length >= 2 ? median(this._gpuSamples) : null;
    this._resetWindow();

    // Isolated 150-1000 ms hitch affects a single window; sustained overload or repeated burst pauses persist >= 1.5 streak.
    // Once settled (>= 4.9s post-warm, ~5.5s after cover lift), widen GPU hysteresis, decay dt streaks faster, and require 2 consecutive slow windows.
    const settled = this.settledMs >= 4900;
    const dtDecayMs = settled ? 2500 : 5000;
    if (dtAvg > this.slow) this._slowDtStreak += 1;
    else this._slowDtStreak = Math.max(0, this._slowDtStreak - winMs / dtDecayMs);

    const sustainedDtOver = (hadHitch || settled) ? this._slowDtStreak >= 1.5 : dtAvg > this.slow;
    const gpuLimit = settled ? this.gpuHoldSlow : this.gpuSlow;
    if (gpuMed !== null && gpuMed > gpuLimit) this._slowGpuStreak++;
    else this._slowGpuStreak = 0;
    const gpuOver = gpuMed !== null && (settled ? this._slowGpuStreak >= 2 : gpuMed > gpuLimit);
    const overloaded = gpuOver || sustainedDtOver;

    if (overloaded) {
      const effectiveMs = gpuOver ? gpuMed : dtAvg;
      const aimMs = gpuOver ? this.gpuAim : this.dtAim;
      const fixedMs = this.frameBudget * 0.25;
      const factor = clamp(Math.sqrt(Math.max(0.1, (aimMs - fixedMs) / Math.max(1, effectiveMs - fixedMs))), 0.45, 0.88);
      let nextScale = Math.max(this.min, this.scale * factor);
      if (nextScale - this.min < 0.05) nextScale = this.min;
      nextScale = Math.round(nextScale * 1000) / 1000;

      let changed = false;
      let droppedTierOnly = false;
      if (this.tier === 0 && !this.tierPinned && (nextScale < 0.85 || this.scalePinned)) {
        this.tier = 1;
        if (!this.scalePinned) {
          if (gpuOver) {
            this.scale = this.max;
            droppedTierOnly = true;
          } else {
            // In dt-fallback mode, GPU queue stalls only surface every ~1-2s when overrun is small;
            // apply nextScale alongside tier 1 instead of resetting to 1.0 and waiting for tier 1 to stall again.
            this.scale = Math.min(this.scale, nextScale);
          }
        }
        changed = true;
      } else if (!this.scalePinned && nextScale < this.scale - 1e-4) {
        this.scale = nextScale;
        changed = true;
      }

      if (changed) {
        if (this._sinceUpgrade < 60000) this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2);
        this.downgradeCool = 50;
        this.upgradeCool = this.backoffMs;
        this._goodMs = 0;
        this._slowDtStreak = droppedTierOnly && !gpuOver ? 1 : 0;
        this._slowGpuStreak = 0;
        return true;
      }
      return false;
    }

    const hasHeadroom = gpuMed !== null
      ? (gpuMed < this.gpuFast && dtAvg < this.fast && !hadHitch)
      : (dtAvg < this.fast && !hadHitch);

    if (hasHeadroom) {
      this._goodMs += winMs;
      if (this._goodMs >= 60000) this.backoffMs = this.baseBackoffMs;
      if (this.upgradeCool <= 0 && !this.scalePinned && this.scale < this.max) {
        let nextScale = Math.min(this.max, this.scale * 1.07);
        if (this.max - nextScale < 0.015) nextScale = this.max;
        nextScale = Math.round(nextScale * 1000) / 1000;
        if (nextScale > this.scale + 1e-4) {
          this.scale = nextScale;
          this.upgradeCool = 2000;
          this._sinceUpgrade = 0;
          return true;
        }
      }
    }

    return false;
  }
}
