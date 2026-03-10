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
import { fromBlob } from "geotiff";

self.onmessage = async (e) => {
  const { file, layerId } = e.data;

  try {
    self.postMessage({
      type: "PROGRESS",
      layerId,
      progress: 10,
      message: "Parsing GeoTIFF…",
    });

    const tiff = await fromBlob(file);
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
        imageCount,
        fileSize: file.size,
      },
    });
  } catch (err) {
    self.postMessage({ type: "ERROR", layerId, error: err.message });
  }
};
