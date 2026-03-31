/**
 * shapeProcessor.js — shared GeoJSON processing logic.
 * Used by both preprocess.js (batch mode) and uploadProcessor.js (per-upload).
 *
 * Exported functions work with in-memory GeoJSON objects so they can be called
 * from any context (file-system batch or memory-buffer upload).
 */
import path from 'path';
import * as turf from '@turf/turf';
import { reproject } from 'reproject';
import epsg from 'epsg-index/all.json' with { type: 'json' };
import { v4 as uuidv4 } from 'uuid';

// ── CRS detection ──────────────────────────────────────────────────────────────

export function detectCrsFromGeojson(geojson) {
  const name = geojson?.crs?.properties?.name ?? '';
  if (name.includes('CRS84')) return 'EPSG:4326';
  const match = name.match(/EPSG::?(\d+)/i);
  return match ? `EPSG:${match[1]}` : 'EPSG:4326';
}

// ── Normalise any GeoJSON to FeatureCollection ─────────────────────────────────

export function normaliseFeatureCollection(geojson) {
  if (geojson.type === 'Feature') {
    return { type: 'FeatureCollection', features: [geojson] };
  }
  return geojson;
}

// ── Reproject ──────────────────────────────────────────────────────────────────

/**
 * Reproject a FeatureCollection to targetCrs.
 * Returns { geojson, step } — step is a human-readable description of what happened.
 */
export function reprojectGeojson(geojson, targetCrs) {
  const sourceCrs = detectCrsFromGeojson(geojson);
  if (sourceCrs === targetCrs) {
    return { geojson, step: `CRS already ${targetCrs} — no reprojection needed` };
  }

  const fromDef = epsg[sourceCrs.split(':')[1]]?.proj4;
  const toDef   = epsg[targetCrs.split(':')[1]]?.proj4;

  if (!fromDef || !toDef) {
    return {
      geojson,
      step: `Reprojection skipped — unknown CRS definition for ${sourceCrs} or ${targetCrs}`,
    };
  }

  try {
    const reprojected = reproject(geojson, fromDef, toDef, epsg);
    return { geojson: reprojected, step: `Reprojected ${sourceCrs} → ${targetCrs}` };
  } catch (err) {
    return { geojson, step: `Reprojection failed: ${err.message} — data kept in ${sourceCrs}` };
  }
}

// ── Simplify ───────────────────────────────────────────────────────────────────

export function simplifyGeojson(geojson, tolerance) {
  if (!tolerance || tolerance <= 0) return geojson;
  try {
    return turf.simplify(geojson, { tolerance, highQuality: false, mutate: false });
  } catch {
    return geojson; // Points or mixed geometry — ignore
  }
}

// ── Truncate ───────────────────────────────────────────────────────────────────

export function truncateGeojson(geojson, precision) {
  try {
    return turf.truncate(geojson, { precision, coordinates: 2, mutate: false });
  } catch {
    return geojson;
  }
}

// ── Feature ID stamping ────────────────────────────────────────────────────────

export function stampFeatureIds(geojson) {
  geojson.features = geojson.features.map((f) => {
    if (!f.properties) f.properties = {};
    if (!f.properties._featureId) f.properties._featureId = uuidv4();
    return f;
  });
  return geojson;
}

// ── Link 3D assets to features ─────────────────────────────────────────────────
/**
 * Given a FeatureCollection and a map of { basename → serverUrl } for 3D models
 * and point clouds, try to match them to features by comparing property values.
 *
 * Matching strategy (in order):
 *  1. Feature property value equals the file's stem (case-insensitive)
 *  2. Any property value is contained in the filename stem (substring)
 *
 * Matched files are written to feature.properties._model3dUrls /
 * feature.properties._pointcloudUrls so the client can open them.
 */
export function linkAssetsToFeatures(geojson, modelMap, pointcloudMap) {
  if (!modelMap.size && !pointcloudMap.size) return { geojson, linkedCount: 0, linkedAssets: { models: {}, pointclouds: {} } };

  let linkedCount = 0;
  const modelCounts = {};
  const pointcloudCounts = {};

  geojson.features = geojson.features.map((feature) => {
    if (!feature.properties) feature.properties = {};
    const propValues = Object.values(feature.properties).map((v) =>
      String(v ?? '').toLowerCase()
    );

    // Models
    const models = [];
    for (const [stem, url] of modelMap) {
      const stemLower = stem.toLowerCase();
      if (propValues.some((v) => v === stemLower || stemLower.includes(v) || v.includes(stemLower))) {
        models.push(url);
        modelCounts[stem] = (modelCounts[stem] ?? 0) + 1;
      }
    }
    if (models.length) {
      feature.properties._model3dUrls = [
        ...(feature.properties._model3dUrls ?? []),
        ...models,
      ];
      linkedCount++;
    }

    // Point clouds
    const clouds = [];
    for (const [stem, url] of pointcloudMap) {
      const stemLower = stem.toLowerCase();
      if (propValues.some((v) => v === stemLower || stemLower.includes(v) || v.includes(stemLower))) {
        clouds.push(url);
        pointcloudCounts[stem] = (pointcloudCounts[stem] ?? 0) + 1;
      }
    }
    if (clouds.length) {
      feature.properties._pointcloudUrls = [
        ...(feature.properties._pointcloudUrls ?? []),
        ...clouds,
      ];
      linkedCount++;
    }

    return feature;
  });

  return { geojson, linkedCount, linkedAssets: { models: modelCounts, pointclouds: pointcloudCounts } };
}

// ── Full pipeline ──────────────────────────────────────────────────────────────

/**
 * Run the full shape processing pipeline on a parsed GeoJSON object.
 * Returns { geojson, steps }.
 */
export function processGeoJsonObject(geojson, { targetCrs, simplifyTolerance, coordinatePrecision, modelMap, pointcloudMap }) {
  const steps = [];

  geojson = normaliseFeatureCollection(geojson);
  geojson = stampFeatureIds(geojson);

  const { geojson: reprojected, step: reprojectStep } = reprojectGeojson(geojson, targetCrs ?? 'EPSG:3031');
  geojson = reprojected;
  steps.push(reprojectStep);

  geojson = simplifyGeojson(geojson, simplifyTolerance ?? 50);
  if (simplifyTolerance > 0) steps.push(`Simplified (tolerance ${simplifyTolerance} m)`);

  geojson = truncateGeojson(geojson, coordinatePrecision ?? 0);

  if (modelMap?.size || pointcloudMap?.size) {
    const { geojson: linked, linkedCount } = linkAssetsToFeatures(geojson, modelMap ?? new Map(), pointcloudMap ?? new Map());
    geojson = linked;
    if (linkedCount > 0) steps.push(`Linked assets to ${linkedCount} feature(s)`);
    else steps.push('No automatic asset–feature matches found (you can link manually via URL fields)');
  }

  // Remove source CRS annotation — server CRS is known from app config
  delete geojson.crs;

  return { geojson, steps };
}
