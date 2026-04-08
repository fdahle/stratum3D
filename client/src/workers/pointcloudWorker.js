/**
 * Web Worker for LAS/LAZ point cloud loading.
 *
 * Running WASM decompression (laz-perf) and point processing off the main
 * thread keeps it free to respond to UI events (e.g. the Stop button)
 * immediately, regardless of file size. The worker can be terminated
 * instantly via worker.terminate() without any cleanup needed.
 *
 * Protocol
 * --------
 * Incoming (from main thread):
 *   { arrayBuffer: ArrayBuffer, fileName: string, maxPoints: number }
 *
 * Outgoing (to main thread):
 *   { type: 'progress', status, progress, loaded, total }
 *   { type: 'result',   posBuffer, colBuffer, totalPoints, sampledPoints, step }
 *   { type: 'error',    message }
 */

self.onmessage = async ({ data: { arrayBuffer, fileName, maxPoints } }) => {
  try {
    const [{ Las }, { createLazPerf }] = await Promise.all([
      import('copc'),
      import('laz-perf'),
    ]);

    const lazPerf = await createLazPerf({ locateFile: (f) => `/wasm/${f}` });

    // Parse header from the first bytes
    const headerBytes = new Uint8Array(arrayBuffer, 0, Math.min(375, arrayBuffer.byteLength));
    const header = Las.Header.parse(headerBytes);
    const { pointCount, pointDataRecordLength, pointDataRecordFormat, pointDataOffset } = header;

    if (pointCount === 0) {
      self.postMessage({ type: 'error', message: 'Point cloud is empty' });
      return;
    }

    // ── Decompression ────────────────────────────────────────────────────────
    // This is the blocking WASM call. Running it here keeps the main thread free.
    self.postMessage({ type: 'progress', status: 'decompressing', progress: 0, loaded: 0, total: pointCount });

    const isLaz = fileName.toLowerCase().endsWith('.laz');
    let pointBytes;
    if (isLaz) {
      pointBytes = await Las.PointData.decompressFile(new Uint8Array(arrayBuffer), lazPerf);
    } else {
      pointBytes = new Uint8Array(arrayBuffer, pointDataOffset, pointCount * pointDataRecordLength);
    }

    // ── Point extraction ─────────────────────────────────────────────────────
    const view = Las.View.create(pointBytes, header);
    const getX = view.getter('X');
    const getY = view.getter('Y');
    const getZ = view.getter('Z');

    const formatsWithColor = new Set([2, 3, 5, 7, 8, 10]);
    const hasColor = formatsWithColor.has(pointDataRecordFormat);
    let getR, getG, getB;
    if (hasColor) {
      getR = view.getter('Red');
      getG = view.getter('Green');
      getB = view.getter('Blue');
    }

    // Intensity is present in all LAS point formats
    const getIntensity = view.getter('Intensity');

    // Classification (lower 5 bits of the classification byte)
    let getClassification = null;
    try { getClassification = view.getter('Classification'); } catch { /* not available in this format */ }

    const step = pointCount > maxPoints ? Math.ceil(pointCount / maxPoints) : 1;
    const allocCount = Math.ceil(pointCount / step);
    const positions       = new Float32Array(allocCount * 3);
    const colors          = new Float32Array(allocCount * 3);
    const intensities     = new Float32Array(allocCount);
    const classifications = new Uint8Array(allocCount);

    const CHUNK = 200_000;
    let sIdx = 0;
    for (let start = 0; start < pointCount; start += CHUNK) {
      const end = Math.min(start + CHUNK, pointCount);
      for (let i = start; i < end; i++) {
        if (i % step !== 0) continue;
        positions[sIdx * 3]     = getX(i);
        positions[sIdx * 3 + 1] = getY(i);
        positions[sIdx * 3 + 2] = getZ(i);
        if (hasColor) {
          colors[sIdx * 3]     = getR(i) / 65535;
          colors[sIdx * 3 + 1] = getG(i) / 65535;
          colors[sIdx * 3 + 2] = getB(i) / 65535;
        } else {
          colors[sIdx * 3] = colors[sIdx * 3 + 1] = colors[sIdx * 3 + 2] = 0.7;
        }
        intensities[sIdx] = getIntensity(i) / 65535;
        classifications[sIdx] = getClassification ? (getClassification(i) & 0x1F) : 0;
        sIdx++;
      }
      self.postMessage({
        type: 'progress', status: 'parsing',
        loaded: end, total: pointCount,
        progress: Math.round((end / pointCount) * 100),
      });
      // Yield so the worker event loop can process any incoming messages
      await new Promise((r) => setTimeout(r, 0));
    }

    // Slice exact-sized transferable buffers (zero-copy transfer to main thread)
    const posBuffer = positions.buffer.slice(0, sIdx * 12);
    const colBuffer = colors.buffer.slice(0, sIdx * 12);
    const intBuffer = intensities.buffer.slice(0, sIdx * 4);
    const clsBuffer = classifications.buffer.slice(0, sIdx);

    self.postMessage(
      { type: 'result', posBuffer, colBuffer, intBuffer, clsBuffer, totalPoints: pointCount, sampledPoints: sIdx, step },
      [posBuffer, colBuffer, intBuffer, clsBuffer],
    );
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
};
