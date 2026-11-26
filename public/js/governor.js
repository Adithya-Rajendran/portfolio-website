// Adaptive quality controller (tier and render scale from GPU timer samples, else frame intervals) and per-room mode storage.

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
    return data.held === true ? { tier: data.tier, scale: data.scale, held: true } : { tier: data.tier, scale: data.scale };
  } catch {
    return null;
  }
}

export function saveRoomMode(storage, roomId, mode, { min = 0.5, max = 1 } = {}) {
  if (!storage || typeof storage.setItem !== 'function' || typeof roomId !== 'string' || !roomId || !mode) return false;
  const tier = mode.tier === 1 ? 1 : mode.tier === 0 ? 0 : null;
  if (tier === null || typeof mode.scale !== 'number' || !Number.isFinite(mode.scale)) return false;
  const scale = Math.round(clamp(mode.scale, min, max) * 10000) / 10000;
  try {
    storage.setItem(storageKey(roomId), JSON.stringify(mode.held === true ? { v: 1, tier, scale, held: true } : { v: 1, tier, scale }));
    return true;
  } catch {
    return false;
  }
}

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
    this.gpuSlow = this.frameBudget * 0.86;
    this.gpuHoldSlow = this.frameBudget * 0.94;
    this.gpuAim = this.frameBudget * 0.66;
    this.gpuFast = this.frameBudget * 0.56;
    this.gpuRoom = this.frameBudget * 0.6;
    this.gpuReach = this.frameBudget * 0.78;
    this.slow = 1000 / (target * 0.86);
    this.fast = 1000 / (target * 0.95);
    this.dtAim = this.frameBudget * 0.80;

    this.windowMs = 250;
    this.gpuStaleMs = 1000;
    this.dtGraceMs = 3000;
    this.fitMs = 1000;
    this.gpuUpCoolMs = 1000;
    this.tierProbeMs = 3000;
    this.tierCost = 1.5;
    this.dtShare = 0.6;
    this.baseBackoffMs = 28000;
    this.maxBackoffMs = 120000;
    this.backoffMs = this.baseBackoffMs;
    this.downgradeCool = 0;
    this.upgradeCool = 0;
    this.settledMs = 0;
    this.capScale = null;
    this.capMs = 0;
    this._goodMs = 0;
    this._sinceUpgrade = 1e9;
    this._slowDtStreak = 0;
    this._slowGpuStreak = 0;
    this._dtWins = [];
    this._sinceCap = 1e9;
    this._gpuSeen = false;
    this._sinceGpu = 0;
    this.tierHeld = false;
    this._tierByDt = false;
    this._tierTried = false;
    this._tier0Gpu = null;
    this._lastGpu = null;
    this._probeMs = 0;
    this._resetFit();
    this._resetWindow();
    this.rest(250);
  }

  get allPinned() {
    return this.scalePinned && this.tierPinned;
  }

  get gpuTimed() {
    return this._gpuSeen ? this._sinceGpu < this.gpuStaleMs : this.hasGpuTimer && this.settledMs < this.gpuStaleMs;
  }

  _resetWindow() {
    this._winMs = 0;
    this._dtSum = 0;
    this._dtCount = 0;
    this._hadHitch = false;
    this._gpuSamples = [];
  }

  _resetFit() {
    this._fitMs = 0;
    this._fitMeds = [];
  }

  rest(ms) {
    this.warm = Math.max(0, ms);
    this._slowDtStreak = 0;
    this._slowGpuStreak = 0;
    this._dtWins = [];
    this._probeMs = 0;
    this._resetFit();
    this._resetWindow();
  }

  reset({ tier = 0, scale = this.max, warm = 250, held = false } = {}) {
    if (!this.tierPinned) this.tier = tier ? 1 : 0;
    if (!this.scalePinned) this.scale = clamp(scale ?? this.max, this.min, this.max);
    this.downgradeCool = 0;
    this.backoffMs = this.baseBackoffMs;
    const restoredBelowMax = (!this.scalePinned && this.scale < this.max) || (!this.tierPinned && this.tier > 0);
    this.upgradeCool = restoredBelowMax ? (this.hasGpuTimer ? this.gpuUpCoolMs : this.backoffMs) : 0;
    this.capScale = null;
    this.capMs = 0;
    this._sinceCap = 1e9;
    this.tierHeld = !!held;
    this._tierByDt = false;
    this._tierTried = false;
    this._tier0Gpu = null;
    this._lastGpu = null;
    this._goodMs = 0;
    this._sinceUpgrade = 1e9;
    this._sinceGpu = 0;
    this.settledMs = 0;
    this.rest(warm);
  }

  _changed(cool) {
    this.downgradeCool = 50;
    this.upgradeCool = cool;
    this._goodMs = 0;
    this._slowGpuStreak = 0;
    this._dtWins = [];
    this._probeMs = 0;
    this._resetFit();
    return true;
  }

  update(dtMs, gpuSamples = null, upload = false) {
    if (this.allPinned || !Number.isFinite(dtMs) || dtMs < 0) return false;
    if (dtMs > 1000) {
      this._slowDtStreak = 0;
      this._slowGpuStreak = 0;
      this._dtWins = [];
      this._resetFit();
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
    if (this.capMs > 0) {
      this.capMs = Math.max(0, this.capMs - dtMs);
      if (this.capMs <= 0) {
        this.capScale = null;
        this._sinceCap = 0;
      }
    } else if (this._sinceCap < 1e9) this._sinceCap += dtMs;

    if (this.downgradeCool > 0) {
      this.downgradeCool = Math.max(0, this.downgradeCool - dtMs);
      if (this.downgradeCool > 0) return false;
      this._resetWindow();
      return false;
    }

    if (!upload) {
      this._winMs += dtMs;
      this._dtSum += dtMs;
      this._dtCount++;
      if (dtMs > 150) this._hadHitch = true;
    }

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

    if (gpuMed !== null) {
      this._gpuSeen = true;
      this._sinceGpu = 0;
      this._lastGpu = this.tier === 0 && this.scale >= this.max ? gpuMed : null;
    } else {
      this._sinceGpu += winMs;
    }
    const gpuTimed = this.gpuTimed;

    const settled = this.settledMs >= 4900;
    const dtDecayMs = settled ? 2500 : 5000;
    if (dtAvg > this.slow) this._slowDtStreak += 1;
    else this._slowDtStreak = Math.max(0, this._slowDtStreak - winMs / dtDecayMs);
    this._dtWins.push([winMs, dtAvg > this.slow]);
    let spanMs = 0;
    for (const [ms] of this._dtWins) spanMs += ms;
    while (this._dtWins.length > 1 && spanMs - this._dtWins[0][0] >= this.dtGraceMs) spanMs -= this._dtWins.shift()[0];
    let slowMs = 0;
    for (const [ms, slow] of this._dtWins) if (slow) slowMs += ms;

    const sustainedDtOver = gpuTimed
      ? settled && spanMs >= this.dtGraceMs && slowMs >= spanMs * this.dtShare
      : (hadHitch || settled) ? this._slowDtStreak >= 1.5 : dtAvg > this.slow;
    const gpuLimit = settled ? this.gpuHoldSlow : this.gpuSlow;
    if (gpuMed !== null && gpuMed > gpuLimit) this._slowGpuStreak++;
    else this._slowGpuStreak = 0;
    const gpuOver = gpuMed !== null && this._slowGpuStreak >= 2;
    const overloaded = gpuOver || sustainedDtOver;

    if (overloaded) {
      const effectiveMs = gpuOver ? gpuMed : dtAvg;
      const aimMs = gpuOver ? this.gpuAim : this.dtAim;
      const fixedMs = this.frameBudget * 0.25;
      const factor = clamp(Math.sqrt(Math.max(0.1, (aimMs - fixedMs) / Math.max(1, effectiveMs - fixedMs))), 0.45, 0.88);
      let nextScale = Math.max(this.min, this.scale * factor);
      if (nextScale - this.min < 0.05) nextScale = this.min;
      nextScale = Math.round(nextScale * 1000) / 1000;

      const overScale = this.scale;
      const recent = this._sinceUpgrade < 60000;
      let changed = false;
      let droppedTierOnly = false;
      if (this.tier === 0 && !this.tierPinned && (nextScale < 0.85 || this.scalePinned)) {
        this.tier = 1;
        if ((gpuOver && settled) || this._tierByDt || this._tierTried) this.tierHeld = true;
        else {
          this._tierByDt = true;
          this._tier0Gpu = gpuTimed ? this._lastGpu : null;
        }
        this.capScale = null;
        this.capMs = 0;
        if (!this.scalePinned) {
          if (gpuOver) {
            this.scale = this.max;
            droppedTierOnly = true;
          } else {
            this.scale = Math.min(this.scale, nextScale);
          }
        }
        changed = true;
      } else if (!this.scalePinned && nextScale < this.scale - 1e-4) {
        this.scale = nextScale;
        changed = true;
      }

      if (changed) {
        if (recent) this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2);
        if (gpuOver && recent && !droppedTierOnly) {
          this.capMs = this.capScale !== null || this.backoffMs >= this.maxBackoffMs ? Infinity : this.backoffMs;
          this.capScale = this.capScale === null ? overScale : Math.min(this.capScale, overScale);
        }
        this._changed(gpuOver || gpuTimed ? this.gpuUpCoolMs : this.backoffMs);
        this._slowDtStreak = droppedTierOnly && !gpuOver ? 1 : 0;
        return true;
      }
      return false;
    }

    if (gpuTimed) return this._gpuUpgrade(winMs, gpuMed, hadHitch || dtAvg > this.slow);

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

  _gpuUpgrade(winMs, gpuMed, slowFrames) {
    if (gpuMed === null || slowFrames) {
      this._resetFit();
      this._probeMs = 0;
      return false;
    }
    if (gpuMed < this.gpuRoom && this.capScale === null && this._sinceCap >= this.backoffMs) {
      this._goodMs += winMs;
      if (this._goodMs >= 60000) this.backoffMs = this.baseBackoffMs;
    }
    this._fitMs += winMs;
    this._fitMeds.push(gpuMed);
    if (this._fitMs < this.fitMs) return false;
    const g = median(this._fitMeds);
    this._resetFit();
    if (this.upgradeCool > 0) {
      this._probeMs = 0;
      return false;
    }

    if (!this.scalePinned && this.scale < this.max) {
      if (g >= this.gpuRoom) return false;
      let limit = this.max;
      if (this.capScale !== null) limit = Math.min(limit, this.capScale * 0.97);
      const fixedMs = this.frameBudget * 0.25;
      const grow = Math.min((this.gpuAim - fixedMs) / Math.max(0.5, g - fixedMs), this.gpuReach / g);
      let nextScale = Math.min(limit, this.scale * Math.sqrt(Math.max(1, grow)));
      if (limit === this.max && this.max - nextScale < 0.015) nextScale = this.max;
      nextScale = Math.floor(nextScale * 1000) / 1000;
      if (nextScale > this.scale + 0.01 || (nextScale === this.max && nextScale > this.scale)) {
        this.scale = nextScale;
        this._sinceUpgrade = 0;
        return this._changed(this.gpuUpCoolMs);
      }
      return false;
    }

    if (this.tier === 1 && !this.tierPinned && !this.tierHeld && this.scale >= this.max
      && (this._tier0Gpu !== null ? this._tier0Gpu < this.gpuSlow : g * this.tierCost < this.gpuFast)) {
      this._probeMs += this.fitMs;
      if (this._probeMs >= this.tierProbeMs) {
        this.tier = 0;
        this._tierTried = true;
        this._sinceUpgrade = 0;
        return this._changed(this.gpuUpCoolMs);
      }
    } else this._probeMs = 0;
    return false;
  }
}
