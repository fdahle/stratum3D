/**
 * Web Worker for pre-parsing GeoTIFF files off the main thread.
 *
 * Blob URLs don't support HTTP range requests, so ol/source/GeoTIFF reads
 * the entire file on the main thread — freezing the UI for large files.
 *
 * This worker uses geotiff.js's fromBlob(), which uses Blob.slice() for
 * efficient random access, to validate the file and extract metadata before
 * the heavy OL source initialisation kicks in.
 */
import { fromBlob, fromUrl } from "geotiff";

self.onmessage = async (e) => {
  const { file, url, layerId } = e.data;

  try {
    self.postMessage({
      type: "PROGRESS",
      layerId,
      progress: 10,
      message: "Parsing GeoTIFF…",
    });

    const tiff = file ? await fromBlob(file) : await fromUrl(url);
    const image = await tiff.getImage();

    self.postMessage({
      type: "PROGRESS",
      layerId,
      progress: 50,
      message: "Reading metadata…",
    });

    const bbox = image.getBoundingBox();
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();

    // Try to determine EPSG code from GeoKeys
    let projection = null;
    const geoKeys = image.getGeoKeys();
    if (geoKeys.ProjectedCSTypeGeoKey) {
      projection = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
    } else if (geoKeys.GeographicTypeGeoKey) {
      projection = `EPSG:${geoKeys.GeographicTypeGeoKey}`;
    }

    self.postMessage({
      type: "PROGRESS",
      layerId,
      progress: 80,
      message: "Checking structure…",
    });

    const imageCount = await tiff.getImageCount();

    // ── Extract min/max for single-band rasters (DEMs, etc.) ─────────────────
    // Without real data range, OL normalizes against the full uint16 range
    // (0–65535), making values like 6–2000 appear nearly black.
    let dataMin = null;
    let dataMax = null;
    const noDataValue = image.getGDALNoData();

    if (samplesPerPixel === 1) {
      // 1. Cheapest: TIFF MinSampleValue / MaxSampleValue tags.
      //    These are file-wide statistics that can include the nodata sentinel
      //    (e.g. -9999) as the global minimum, so skip any value that matches
      //    the nodata value to avoid a distorted stretch range.
      const fileDir = image.getFileDirectory();
      const tagMin = fileDir.MinSampleValue?.[0];
      const tagMax = fileDir.MaxSampleValue?.[0];
      if (tagMin != null && (noDataValue === null || tagMin !== noDataValue)) dataMin = tagMin;
      if (tagMax != null && (noDataValue === null || tagMax !== noDataValue)) dataMax = tagMax;

      // 2. GDAL statistics embedded as XML in GDAL_METADATA tag
      if ((dataMin === null || dataMax === null) && fileDir.GDAL_METADATA) {
        const xml = fileDir.GDAL_METADATA;
        const minMatch = xml.match(/name="STATISTICS_MINIMUM"[^>]*>([^<]+)/);
        const maxMatch = xml.match(/name="STATISTICS_MAXIMUM"[^>]*>([^<]+)/);
        if (minMatch) dataMin = parseFloat(minMatch[1]);
        if (maxMatch) dataMax = parseFloat(maxMatch[1]);
      }

      // 3. Fallback: request a ≤512×512 downsampled thumbnail directly from
      //    geotiff.js so the scan is fast for any image size — no pixel cap.
      //    Using 'nearest' resampling avoids blending nodata into valid pixels.
      if (dataMin === null || dataMax === null) {
        try {
          self.postMessage({ type: "PROGRESS", layerId, progress: 85, message: "Analysing data range…" });
          const sampleIdx = imageCount > 1 ? imageCount - 1 : 0;
          const sampleImg = await tiff.getImage(sampleIdx);
          const sampleW = sampleImg.getWidth();
          const sampleH = sampleImg.getHeight();

          const maxSide = 512;
          const scale = Math.min(1, maxSide / Math.max(sampleW, sampleH, 1));
          const scanW = Math.max(1, Math.round(sampleW * scale));
          const scanH = Math.max(1, Math.round(sampleH * scale));

          const [raster] = await sampleImg.readRasters({
            samples: [0],
            width: scanW,
            height: scanH,
            resampleMethod: 'nearest',
          });

          // Tolerance-based nodata check to handle float32 precision differences
          const ndTol = noDataValue !== null ? Math.max(0.5, Math.abs(noDataValue) * 1e-6) : 0;
          let mn = Infinity, mx = -Infinity;
          for (let i = 0; i < raster.length; i++) {
            const v = raster[i];
            if (!isFinite(v)) continue;
            if (noDataValue !== null && Math.abs(v - noDataValue) <= ndTol) continue;
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
          if (isFinite(mn) && isFinite(mx) && mn < mx) {
            dataMin = mn;
            dataMax = mx;
          }
        } catch (_) {
          // Non-fatal — layer will still render, just potentially flat
        }
      }
    }

    self.postMessage({
      type: "COMPLETE",
      layerId,
      metadata: {
        extent: bbox,
        projection,
        width,
        height,
        bands: samplesPerPixel,
        hasOverviews: imageCount > 1,
        isTiled: image.isTiled,
        imageCount,
        fileSize: file?.size ?? null,
        dataMin,
        dataMax,
        noDataValue,
      },
    });
  } catch (err) {
    self.postMessage({ type: "ERROR", layerId, error: err.message });
  }
};
