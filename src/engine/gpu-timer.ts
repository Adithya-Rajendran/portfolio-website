// The GPU timer of the frame loop: one timer query around each drawn frame and the times that have come back.
export interface GpuTimer {
  has: boolean;
  reset(): void;
  drain(): number[] | null;
  begin(want: boolean): WebGLQuery | null;
  end(query: WebGLQuery | null, upload: boolean): void;
  lost(): void;
}

export function createGpuTimer(gl: WebGL2RenderingContext): GpuTimer {
  const ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2') || null;
  const pending: { q: WebGLQuery; epoch: number; upload: boolean }[] = [];
  let epoch = 0, stall = 0;
  function reset() {
    epoch++;
    stall = 0;
    while (pending.length) {
      const { q } = pending.shift()!;
      try { if (!gl.isContextLost()) gl.deleteQuery(q); } catch {}
    }
  }
  function drain(): number[] | null {
    if (!ext || !pending.length || gl.isContextLost()) return null;
    const samples: number[] = [];
    let disjoint: boolean | null = null;
    while (pending.length) {
      const head = pending[0];
      if (!gl.getQueryParameter(head.q, gl.QUERY_RESULT_AVAILABLE)) break;
      pending.shift();
      if (disjoint === null) disjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT);
      const ns = (!disjoint && head.epoch === epoch) ? gl.getQueryParameter(head.q, gl.QUERY_RESULT) : 0;
      gl.deleteQuery(head.q);
      if (!disjoint && !head.upload && head.epoch === epoch && typeof ns === 'number' && Number.isFinite(ns) && ns > 0) {
        samples.push(ns / 1e6);
      }
    }
    if (samples.length) stall = 0;
    else if (pending.length && ++stall > 90) reset();
    return samples;
  }
  function begin(want: boolean): WebGLQuery | null {
    if (!want || !ext || pending.length >= 24 || gl.isContextLost() || gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return null;
    const q = gl.createQuery();
    if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    return q;
  }
  function end(q: WebGLQuery | null, upload: boolean) {
    if (q && ext && !gl.isContextLost()) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push({ q, epoch, upload });
    }
  }
  function lost() { pending.length = 0; epoch++; }
  return { has: !!ext, reset, drain, begin, end, lost };
}
