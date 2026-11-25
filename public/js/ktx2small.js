// The small levels of a KTX2 file as a KTX2 file of their own (task O7b). A KTX2 file stores its mip levels smallest
// first, after its header, level index, data format, key/value and supercompression data, so its first bytes hold
// everything but its largest levels. tools/pack.py cuts each texture there into <name>.head.ktx2 and <name>.tail.ktx2;
// js/room.js fetches the head first, and smallKTX2() rewrites it as a valid file (fewer levels, a smaller base size)
// that KTX2Loader transcodes like any other. Head and tail joined are the whole file. No DOM, no three.js.
const align = (o, a) => Math.ceil(o / a) * a;

/** @param buf  the first bytes of a KTX2 file, at least up to the end of its levels below drop
 *  @param drop how many of the largest levels are not in buf
 *  @returns an ArrayBuffer holding a KTX2 file of the levels drop..n-1 */
export function smallKTX2(buf, drop) {
  const src = new Uint8Array(buf), dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const u32 = (o) => dv.getUint32(o, true), u64 = (o) => Number(dv.getBigUint64(o, true));
  const w = u32(20), h = u32(24), depth = Math.max(1, u32(28)), layers = Math.max(1, u32(32)), faces = u32(36), n = u32(40), scheme = u32(44);
  if (!(drop > 0 && drop < n)) throw new Error(`smallKTX2: cannot drop ${drop} of ${n} levels`);
  const keep = n - drop, levels = [];
  for (let i = drop; i < n; i++) levels.push({ offset: u64(80 + 24 * i), length: u64(88 + 24 * i), raw: u64(96 + 24 * i) });
  for (const l of levels) if (l.offset + l.length > src.length) throw new Error('smallKTX2: a kept level is past the bytes given');
  const dfd = src.subarray(u32(48), u32(48) + u32(52)), kvd = src.subarray(u32(56), u32(56) + u32(60));
  let sgd = src.subarray(u64(64), u64(64) + u64(72));
  if (scheme === 1 && sgd.length) {                                 // BasisLZ: one image description per level, layer, face and slice, level 0 first
    const per = layers * faces * depth * 20, from = 20 + drop * per, to = 20 + n * per;
    const out = new Uint8Array(sgd.length - (from - 20));
    out.set(sgd.subarray(0, 20)); out.set(sgd.subarray(from, to), 20); out.set(sgd.subarray(to), 20 + (to - from));
    sgd = out;
  }
  // the same order as a packed file: header, level index, data format, key/values, supercompression data, levels (smallest first)
  let o = 80 + 24 * keep;
  const dfdAt = o; o += dfd.length;
  const kvdAt = kvd.length ? o : 0; o += kvd.length;
  const sgdAt = sgd.length ? (o = align(o, 8)) : 0; o += sgd.length;
  const step = scheme ? 1 : 16;                                     // a supercompressed level needs no alignment
  const at = [];
  for (const i of levels.map((l, i) => i).sort((a, b) => levels[a].offset - levels[b].offset)) { o = align(o, step); at[i] = o; o += levels[i].length; }
  const out = new Uint8Array(o), ov = new DataView(out.buffer);
  out.set(src.subarray(0, 80));
  ov.setUint32(20, Math.max(1, w >> drop), true);
  ov.setUint32(24, h ? Math.max(1, h >> drop) : 0, true);
  ov.setUint32(40, keep, true);
  ov.setUint32(48, dfdAt, true); ov.setUint32(52, dfd.length, true);
  ov.setUint32(56, kvdAt, true); ov.setUint32(60, kvd.length, true);
  ov.setBigUint64(64, BigInt(sgdAt), true); ov.setBigUint64(72, BigInt(sgd.length), true);
  levels.forEach((l, i) => {
    ov.setBigUint64(80 + 24 * i, BigInt(at[i]), true); ov.setBigUint64(88 + 24 * i, BigInt(l.length), true); ov.setBigUint64(96 + 24 * i, BigInt(l.raw), true);
    out.set(src.subarray(l.offset, l.offset + l.length), at[i]);
  });
  out.set(dfd, dfdAt); out.set(kvd, kvdAt); out.set(sgd, sgdAt);
  return out.buffer;
}
