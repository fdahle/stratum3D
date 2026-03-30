/**
 * Upload processor — handles incoming admin file uploads.
 *
 * Supported types:
 *   GeoJSON (.geojson, .json) — reproject + simplify + truncate (via shapeProcessor)
 *   GeoTIFF  (.tif, .tiff)   — stored as-is; COG requires gdal_translate
 *   3D Model (.obj, .ply, .stl) — OBJ: also copies .mtl + textures; updates references
 *   Point Cloud (.las, .laz, .copc.laz) — stored as-is; COPC conversion requires PDAL
 *
 * Multi-file uploads: when a GeoJSON is uploaded together with 3D models / point clouds
 * in the same request, the processor automatically attempts to link the assets to
 * matching features via property values.
 */
import path from 'path';
import fs from 'fs/promises';
import { normalizeFilename } from '../utils.js';
import { processGeoJsonObject, linkAssetsToFeatures } from './shapeProcessor.js';

// ── File-type helpers ──────────────────────────────────────────────────────────

const GEOJSON_EXTS    = new Set(['.geojson', '.json']);
const GEOTIFF_EXTS    = new Set(['.tif', '.tiff']);
const MODEL_EXTS      = new Set(['.obj', '.ply', '.stl']);
const POINTCLOUD_EXTS = new Set(['.las', '.laz']);

export function classifyExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  // .copc.laz is a point cloud too
  if (filename.toLowerCase().endsWith('.copc.laz')) return 'pointcloud';
  if (GEOJSON_EXTS.has(ext))     return 'geojson';
  if (GEOTIFF_EXTS.has(ext))     return 'geotiff';
  if (MODEL_EXTS.has(ext))       return 'model';
  if (POINTCLOUD_EXTS.has(ext))  return 'pointcloud';
  return 'unknown';
}

async function loadShapeConfig(serverDir) {
  try {
    const raw = await fs.readFile(path.join(serverDir, 'preprocess_config.json'), 'utf8');
    return JSON.parse(raw).shapes ?? {};
  } catch {
    return {};
  }
}

// ── GeoJSON ────────────────────────────────────────────────────────────────────

/**
 * Process a GeoJSON buffer through the full pipeline (reproject, simplify, truncate).
 * modelMap and pointcloudMap are Map<stem, serverUrl> built from co-uploaded files.
 */
export async function processGeoJsonUpload(buffer, originalFilename, dataDir, serverDir, modelMap, pointcloudMap) {
  const shapeCfg = await loadShapeConfig(serverDir);

  let geojson;
  try {
    geojson = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!geojson || typeof geojson !== 'object') throw new Error('File is not valid GeoJSON.');
  if (geojson.type !== 'Feature' && geojson.type !== 'FeatureCollection') {
    throw new Error('File does not appear to be valid GeoJSON (expected Feature or FeatureCollection).');
  }

  const { geojson: processed, steps } = processGeoJsonObject(geojson, {
    targetCrs:          shapeCfg.targetCrs          ?? 'EPSG:3031',
    simplifyTolerance:  shapeCfg.simplifyTolerance  ?? 50,
    coordinatePrecision: shapeCfg.coordinatePrecision ?? 0,
    modelMap:       modelMap      ?? new Map(),
    pointcloudMap:  pointcloudMap ?? new Map(),
  });

  await fs.mkdir(path.join(dataDir, 'shapes'), { recursive: true });
  const stem           = normalizeFilename(path.parse(originalFilename).name);
  const outputFilename = stem + '.geojson';
  const outputPath     = path.join(dataDir, 'shapes', outputFilename);
  await fs.writeFile(outputPath, JSON.stringify(processed), 'utf8');

  return {
    type:         'geojson',
    filename:     outputFilename,
    dataPath:     `data/shapes/${outputFilename}`,
    featureCount: processed.features?.length ?? 0,
    steps,
  };
}

// ── GeoTIFF ────────────────────────────────────────────────────────────────────

export async function saveGeoTiffUpload(buffer, originalFilename, dataDir) {
  await fs.mkdir(path.join(dataDir, 'geotiffs'), { recursive: true });
  const stem           = normalizeFilename(path.parse(originalFilename).name);
  const ext            = path.extname(originalFilename).toLowerCase() || '.tif';
  const outputFilename = stem + ext;
  const outputPath     = path.join(dataDir, 'geotiffs', outputFilename);
  await fs.writeFile(outputPath, buffer);

  return {
    type:     'geotiff',
    filename: outputFilename,
    dataPath: `data/geotiffs/${outputFilename}`,
    steps:    ['Stored as-is (Cloud Optimised GeoTIFF output requires gdal_translate — run manually if needed)'],
  };
}

// ── 3D Models ──────────────────────────────────────────────────────────────────

/**
 * Save a 3D model buffer to data/3D/.
 * For OBJ files: also writes any co-uploaded MTL and texture files,
 * and patches the mtllib reference inside the OBJ so the browser can load it.
 */
export async function save3DModelUpload(fileMap, primaryFilename, dataDir) {
  await fs.mkdir(path.join(dataDir, '3D'), { recursive: true });

  const steps = [];
  const ext     = path.extname(primaryFilename).toLowerCase();
  const stem    = normalizeFilename(path.parse(primaryFilename).name);
  const outName = stem + ext;
  const outPath = path.join(dataDir, '3D', outName);

  // Write primary model file
  await fs.writeFile(outPath, fileMap.get(primaryFilename));
  steps.push(`Saved model: ${outName}`);

  // OBJ: handle companion MTL + textures
  if (ext === '.obj') {
    const mtlOrigName = path.parse(primaryFilename).name + '.mtl';
    const mtlNormName = normalizeFilename(mtlOrigName);

    const mtlBuffer = fileMap.get(mtlOrigName) ?? fileMap.get(mtlNormName);
    if (mtlBuffer) {
      await fs.writeFile(path.join(dataDir, '3D', mtlNormName), mtlBuffer);
      steps.push(`Saved material: ${mtlNormName}`);

      // Patch OBJ to reference the (possibly renamed) MTL
      try {
        let objContent = (await fs.readFile(outPath)).toString('utf8');
        objContent = objContent.replace(/^mtllib\s+.+$/m, `mtllib ${mtlNormName}`);
        await fs.writeFile(outPath, objContent, 'utf8');
      } catch { /* non-fatal */ }

      // Copy textures referenced in MTL
      const mtlText = mtlBuffer.toString('utf8');
      const textureRefs = (mtlText.match(/(?:map_Kd|map_Ka|map_Ks|map_Ns|map_d|map_bump|bump)\s+(\S+)/gi) ?? [])
        .map((m) => m.split(/\s+/)[1]);

      for (const texRef of textureRefs) {
        const texNorm  = normalizeFilename(texRef);
        const texBuf   = fileMap.get(texRef) ?? fileMap.get(texNorm);
        if (texBuf) {
          await fs.writeFile(path.join(dataDir, '3D', texNorm), texBuf);
          steps.push(`Saved texture: ${texNorm}`);
          // Patch MTL texture reference to normalized name
          const updatedMtl = (await fs.readFile(path.join(dataDir, '3D', mtlNormName)))
            .toString('utf8')
            .replace(new RegExp(texRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), texNorm);
          await fs.writeFile(path.join(dataDir, '3D', mtlNormName), updatedMtl, 'utf8');
        }
      }
    } else {
      steps.push('No MTL file found in upload — model may render without materials');
    }
  }

  return {
    type:     'model',
    filename: outName,
    dataPath: `data/3D/${outName}`,
    steps,
  };
}

// ── Point Clouds ───────────────────────────────────────────────────────────────

export async function savePointcloudUpload(buffer, originalFilename, dataDir) {
  await fs.mkdir(path.join(dataDir, 'pointclouds'), { recursive: true });
  const stem           = normalizeFilename(path.parse(originalFilename).name);
  const ext            = originalFilename.toLowerCase().endsWith('.copc.laz') ? '.copc.laz'
                       : path.extname(originalFilename).toLowerCase();
  const outputFilename = stem + ext;
  const outputPath     = path.join(dataDir, 'pointclouds', outputFilename);
  await fs.writeFile(outputPath, buffer);

  const isCOPC = outputFilename.endsWith('.copc.laz');
  return {
    type:     'pointcloud',
    filename: outputFilename,
    dataPath: `data/pointclouds/${outputFilename}`,
    steps:    [
      isCOPC
        ? 'Stored as Cloud Optimised Point Cloud (COPC) — ready to use'
        : 'Stored as-is (converting to .copc.laz with PDAL is recommended for streaming)',
    ],
  };
}

// ── Multi-file batch processor ─────────────────────────────────────────────────

/**
 * Process an array of uploaded files { originalname, buffer }.
 * Returns an array of result objects, one per "primary" file.
 * MTL and texture files are handled transparently when an OBJ is present.
 *
 * Linking: if a GeoJSON and 3D/pointcloud files are uploaded together,
 * assets are linked into matching features automatically.
 */
export async function processBatchUpload(files, dataDir, serverDir) {
  // Index all buffers by original name for companion-file lookups
  const fileMap = new Map(files.map((f) => [f.originalname, f.buffer]));

  // Classify files
  const byType = { geojson: [], geotiff: [], model: [], pointcloud: [], companion: [] };
  for (const f of files) {
    const kind = classifyExt(f.originalname);
    const ext  = path.extname(f.originalname).toLowerCase();

    // MTL and image files (textures) are companions to OBJ — handled inside save3DModelUpload
    if (ext === '.mtl' || ['.jpg', '.jpeg', '.png', '.bmp', '.tga', '.gif', '.webp'].includes(ext)) {
      byType.companion.push(f);
    } else if (kind !== 'unknown') {
      byType[kind].push(f);
    }
  }

  const results = [];

  // 1. Save 3D models (also uses companion MTL/textures via fileMap)
  for (const f of byType.model) {
    results.push(await save3DModelUpload(fileMap, f.originalname, dataDir));
  }

  // 2. Save point clouds
  for (const f of byType.pointcloud) {
    results.push(await savePointcloudUpload(f.buffer, f.originalname, dataDir));
  }

  // 3. Build maps of stem → serverUrl for linking into GeoJSON features
  const modelMap      = new Map(results.filter(r => r.type === 'model')
    .map(r => [path.parse(r.filename).name, r.dataPath]));
  const pointcloudMap = new Map(results.filter(r => r.type === 'pointcloud')
    .map(r => [path.parse(r.filename).name, r.dataPath]));

  // 4. Process GeoJSON (with linking)
  for (const f of byType.geojson) {
    results.push(await processGeoJsonUpload(f.buffer, f.originalname, dataDir, serverDir, modelMap, pointcloudMap));
  }

  // 5. Save GeoTIFFs
  for (const f of byType.geotiff) {
    results.push(await saveGeoTiffUpload(f.buffer, f.originalname, dataDir));
  }

  return results;
}

// ── Re-link existing GeoJSON against currently stored assets ───────────────────

/**
 * Re-run feature linking for an already-processed GeoJSON file on disk.
 * Scans all files currently in data/3D/ and data/pointclouds/ and attempts
 * to match them to features. Existing _model3dUrls / _pointcloudUrls are replaced.
 */
export async function relinkGeojson(filename, dataDir) {
  const safe     = path.basename(filename); // prevent path traversal
  const filePath = path.join(dataDir, 'shapes', safe);

  const raw = await fs.readFile(filePath, 'utf8');
  let geojson;
  try { geojson = JSON.parse(raw); }
  catch { throw new Error(`Could not parse ${safe} as JSON.`); }

  const [modelFiles, pcFiles] = await Promise.all([
    fs.readdir(path.join(dataDir, '3D')).catch(() => []),
    fs.readdir(path.join(dataDir, 'pointclouds')).catch(() => []),
  ]);

  const modelMap = new Map(
    modelFiles
      .filter(f => /\.(obj|ply|stl)$/i.test(f))
      .map(f => [path.parse(f).name, `data/3D/${f}`])
  );
  const pointcloudMap = new Map(
    pcFiles
      .filter(f => /\.(las|laz)$/i.test(f))
      .map(f => [path.parse(f).name, `data/pointclouds/${f}`])
  );

  const { geojson: linked, linkedCount } = linkAssetsToFeatures(geojson, modelMap, pointcloudMap);
  await fs.writeFile(filePath, JSON.stringify(linked), 'utf8');

  return {
    filename: safe,
    linkedCount,
    availableModels:      modelMap.size,
    availablePointclouds: pointcloudMap.size,
  };
}
