/**
 * uploadProcessor.js — handles incoming admin file uploads.
 *
 * Each uploaded primary file gets its own UUID directory under data/layers/:
 *   data/layers/{uuid}/
 *     {uuid}.{ext}           — main data file (original name preserved in meta)
 *     {uuid}.meta.json       — sidecar with all metadata
 *     {subId}.{ext}          — sub-files (MTL, textures, linked 3D, pointclouds, CSV)
 *
 * Grouping rules when multiple files are uploaded at once:
 *   • A GeoJSON is the primary; .obj/.ply/.stl/.las/.laz uploaded together become
 *     sub-files of that GeoJSON and are auto-linked into matching features.
 *   • If no GeoJSON is present, each model / pointcloud becomes its own layer.
 *   • GeoTIFFs are always standalone layers.
 *   • MTL and texture files are companions of the OBJ in the same upload.
 *
 * Per-file settings are passed from the client upload modal as a JSON field
 * keyed by original filename.
 */
import path   from 'path';
import fs     from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

import { normalizeFilename }     from '../src/utils.js';
import { processGeoJsonObject, linkAssetsToFeatures } from './shapeProcessor.js';
import {
  createLayerMeta,
  createSubFileMeta,
  writeLayerMeta,
  readLayerMeta,
} from '../src/layerStore.js';

// ── File-type helpers ──────────────────────────────────────────────────────────

const GEOJSON_EXTS    = new Set(['.geojson', '.json']);
const GEOTIFF_EXTS    = new Set(['.tif', '.tiff']);
const MODEL_EXTS      = new Set(['.obj', '.ply', '.stl']);
const POINTCLOUD_EXTS = new Set(['.las', '.laz']);

const TEXTURE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.tga', '.gif', '.webp']);

export function classifyExt(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.copc.laz')) return 'pointcloud';
  const ext = path.extname(lower);
  if (GEOJSON_EXTS.has(ext))    return 'geojson';
  if (GEOTIFF_EXTS.has(ext))    return 'geotiff';
  if (MODEL_EXTS.has(ext))      return 'model';
  if (POINTCLOUD_EXTS.has(ext)) return 'pointcloud';
  if (ext === '.csv')           return 'csv';
  return 'unknown';
}

function isCompanion(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.mtl' || TEXTURE_EXTS.has(ext);
}

function pointcloudExt(filename) {
  return filename.toLowerCase().endsWith('.copc.laz') ? '.copc.laz'
       : path.extname(filename).toLowerCase();
}

function extractTextureRefs(mtlContent) {
  return (mtlContent.match(/(?:map_Kd|map_Ka|map_Ks|map_Ns|map_d|map_bump|bump)\s+(\S+)/gi) ?? [])
    .map(m => m.split(/\s+/)[1]);
}

// ── Main batch processor ───────────────────────────────────────────────────────

/**
 * Process an array of uploaded files into UUID-based layer storage.
 * @param {Array<{originalname:string,buffer:Buffer}>} files
 * @param {string} layersDir  — absolute path to data/layers/
 * @param {Object} allSettings — per-filename settings from the upload modal
 */
export async function processUploadBatch(files, layersDir, allSettings = {}) {
  await fs.mkdir(layersDir, { recursive: true });

  const fileMap = new Map(files.map(f => [f.originalname, f.buffer]));

  const byType = { geojson: [], geotiff: [], model: [], pointcloud: [], companion: [], csv: [] };
  for (const f of files) {
    if (isCompanion(f.originalname)) byType.companion.push(f);
    else {
      const kind = classifyExt(f.originalname);
      if (kind !== 'unknown') byType[kind].push(f);
    }
  }

  const results = [];

  if (byType.geojson.length > 0) {
    for (const geoFile of byType.geojson) {
      results.push(await _processGeoJsonLayer(geoFile, byType.model, byType.pointcloud, fileMap, layersDir, allSettings));
    }
  } else {
    for (const modelFile of byType.model) {
      results.push(await _processStandaloneModel(modelFile, fileMap, layersDir, allSettings));
    }
    for (const pcFile of byType.pointcloud) {
      results.push(await _processStandalonePointcloud(pcFile, layersDir, allSettings));
    }
  }

  for (const tifFile of byType.geotiff) {
    results.push(await _processGeoTiffLayer(tifFile, layersDir, allSettings));
  }

  for (const csvFile of byType.csv) {
    results.push(await _processCsvLayer(csvFile, layersDir, allSettings));
  }

  return results;
}

// ── GeoJSON layer ──────────────────────────────────────────────────────────────

async function _processGeoJsonLayer(geoFile, modelFiles, pointcloudFiles, fileMap, layersDir, allSettings) {
  const id       = uuidv4();
  const layerDir = path.join(layersDir, id);
  await fs.mkdir(layerDir, { recursive: true });

  const settings = allSettings[geoFile.originalname] ?? {};
  const meta     = createLayerMeta({ id, originalName: geoFile.originalname, fileType: 'geojson', options: settings });

  const modelMap      = new Map();
  const pointcloudMap = new Map();

  for (const modelFile of modelFiles) {
    const subRes = await _saveModelSubFile(modelFile, fileMap, id, layerDir);
    modelMap.set(path.parse(modelFile.originalname).name, subRes.url);
    meta.subFiles.push(subRes.subMeta);
  }

  for (const pcFile of pointcloudFiles) {
    const subId  = uuidv4();
    const ext    = pointcloudExt(pcFile.originalname);
    await fs.writeFile(path.join(layerDir, `${subId}${ext}`), pcFile.buffer);
    const url    = `data/layers/${id}/${subId}${ext}`;
    pointcloudMap.set(path.parse(pcFile.originalname).name, url);
    meta.subFiles.push(createSubFileMeta({ id: subId, originalName: pcFile.originalname, fileType: 'pointcloud', role: 'pointcloud' }));
  }

  let geojson;
  try {
    geojson = JSON.parse(geoFile.buffer.toString('utf8'));
  } catch {
    throw new Error(`${geoFile.originalname} is not valid JSON.`);
  }
  if (!geojson || (geojson.type !== 'Feature' && geojson.type !== 'FeatureCollection')) {
    throw new Error(`${geoFile.originalname} does not appear to be valid GeoJSON.`);
  }

  const shapeCfg = settings.shapeSettings ?? {};
  const { geojson: processed, steps, sourceCrs, targetCrs } = processGeoJsonObject(geojson, {
    targetCrs:           shapeCfg.targetCrs           ?? 'EPSG:3031',
    simplifyTolerance:   shapeCfg.simplifyTolerance   ?? 50,
    coordinatePrecision: shapeCfg.coordinatePrecision ?? 0,
    sourceCrs:           shapeCfg.sourceCrs           ?? null,
    modelMap,
    pointcloudMap,
  });

  if (settings.keepOriginal) {
    const backupName = `original_${id}.geojson`;
    await fs.writeFile(path.join(layerDir, backupName), geoFile.buffer);
    meta.originalBackup = backupName;
  }

  await fs.writeFile(path.join(layerDir, `${id}.geojson`), JSON.stringify(processed), 'utf8');
  meta.processingLog = steps;
  meta.sourceCrs     = sourceCrs ?? null;
  meta.targetCrs     = targetCrs ?? null;
  meta.featureCount  = processed.features?.length ?? null;
  meta.featureIndex  = processed.features?.map((f, i) => ({ id: f.properties?._featureId ?? null, index: i })) ?? null;
  await writeLayerMeta(layersDir, id, meta);

  return {
    id,
    type:         'geojson',
    originalName: geoFile.originalname,
    displayName:  meta.layerConfig.displayName,
    dataPath:     `data/layers/${id}/${id}.geojson`,
    featureCount: processed.features?.length ?? 0,
    sourceCrs,
    targetCrs,
    steps,
    status:       'ready',
  };
}

// ── OBJ/MTL/texture sub-file helper ───────────────────────────────────────────

async function _saveModelSubFile(modelFile, fileMap, parentLayerId, layerDir) {
  const subId   = uuidv4();
  const ext     = path.extname(modelFile.originalname).toLowerCase();
  const outFile = `${subId}${ext}`;
  const url     = `data/layers/${parentLayerId}/${outFile}`;
  const subMeta = createSubFileMeta({ id: subId, originalName: modelFile.originalname, fileType: 'model', role: 'model' });

  if (ext === '.obj') {
    let objContent = modelFile.buffer.toString('utf8');
    const mtlOrigName = path.parse(modelFile.originalname).name + '.mtl';
    const mtlBuf      = fileMap.get(mtlOrigName) ?? fileMap.get(normalizeFilename(mtlOrigName));

    if (mtlBuf) {
      const mtlSubId  = uuidv4();
      const mtlFile   = `${mtlSubId}.mtl`;
      objContent      = objContent.replace(/^mtllib\s+.+$/m, `mtllib ${mtlFile}`);

      const textureRefs = extractTextureRefs(mtlBuf.toString('utf8'));
      let mtlContent    = mtlBuf.toString('utf8');
      const texMeta     = [];

      for (const texRef of textureRefs) {
        const texBuf = fileMap.get(texRef) ?? fileMap.get(normalizeFilename(texRef));
        if (texBuf) {
          const texExt   = path.extname(texRef).toLowerCase();
          const texSubId = uuidv4();
          const texFile  = `${texSubId}${texExt}`;
          await fs.writeFile(path.join(layerDir, texFile), texBuf);
          mtlContent = mtlContent.replace(
            new RegExp(texRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), texFile
          );
          texMeta.push(createSubFileMeta({ id: texSubId, originalName: texRef, fileType: 'texture', role: 'texture' }));
        }
      }

      await fs.writeFile(path.join(layerDir, mtlFile), mtlContent, 'utf8');
      subMeta.companions = [
        createSubFileMeta({ id: mtlSubId, originalName: mtlOrigName, fileType: 'material', role: 'material' }),
        ...texMeta,
      ];
    }
    await fs.writeFile(path.join(layerDir, outFile), objContent, 'utf8');
  } else {
    await fs.writeFile(path.join(layerDir, outFile), modelFile.buffer);
  }

  return { subMeta, url };
}

// ── Standalone model layer ─────────────────────────────────────────────────────

async function _processStandaloneModel(modelFile, fileMap, layersDir, allSettings) {
  const id       = uuidv4();
  const layerDir = path.join(layersDir, id);
  await fs.mkdir(layerDir, { recursive: true });

  const settings = allSettings[modelFile.originalname] ?? {};
  const meta     = createLayerMeta({ id, originalName: modelFile.originalname, fileType: 'model', options: settings });

  const ext     = path.extname(modelFile.originalname).toLowerCase();
  const outFile = `${id}${ext}`;

  // Use a temp id for sub-file helper then rename to main id
  const subRes  = await _saveModelSubFile(modelFile, fileMap, id, layerDir);
  const tmpFile = path.join(layerDir, `${subRes.subMeta.id}${ext}`);
  await fs.rename(tmpFile, path.join(layerDir, outFile)).catch(() => {});
  if (subRes.subMeta.companions) meta.subFiles.push(...subRes.subMeta.companions);

  meta.processingLog = [`Saved 3D model: ${modelFile.originalname}`];
  await writeLayerMeta(layersDir, id, meta);

  return {
    id,
    type:         'model',
    originalName: modelFile.originalname,
    displayName:  meta.layerConfig.displayName,
    dataPath:     `data/layers/${id}/${outFile}`,
    steps:        meta.processingLog,
    status:       'ready',
  };
}

// ── Standalone pointcloud layer ────────────────────────────────────────────────

async function _processStandalonePointcloud(pcFile, layersDir, allSettings) {
  const id       = uuidv4();
  const layerDir = path.join(layersDir, id);
  await fs.mkdir(layerDir, { recursive: true });

  const settings = allSettings[pcFile.originalname] ?? {};
  const meta     = createLayerMeta({ id, originalName: pcFile.originalname, fileType: 'pointcloud', options: settings });

  const ext      = pointcloudExt(pcFile.originalname);
  const mainFile = `${id}${ext}`;
  await fs.writeFile(path.join(layerDir, mainFile), pcFile.buffer);

  if (settings.keepOriginal) {
    const backupName = `original_${id}${ext}`;
    await fs.writeFile(path.join(layerDir, backupName), pcFile.buffer);
    meta.originalBackup = backupName;
  }

  const isCOPC = ext.endsWith('.copc.laz');
  const wantsCOPC = settings.optimize === 'copc';
  const step   = isCOPC
    ? 'Stored as Cloud Optimised Point Cloud (COPC) — ready for streaming'
    : wantsCOPC
      ? 'Point cloud saved — COPC conversion queued (will be optimised in the background)'
      : 'Stored as-is — enable "Optimise as COPC" in upload settings for better streaming performance';

  meta.processingLog = [step];
  meta.status        = wantsCOPC && !isCOPC ? 'optimizing' : 'ready';
  if (wantsCOPC && !isCOPC) meta.optimizationType = 'copc';
  await writeLayerMeta(layersDir, id, meta);

  return {
    id,
    type:              'pointcloud',
    originalName:      pcFile.originalname,
    displayName:       meta.layerConfig.displayName,
    dataPath:          `data/layers/${id}/${mainFile}`,
    steps:             meta.processingLog,
    status:            meta.status,
    optimizationType:  meta.optimizationType ?? null,
  };
}

// ── GeoTIFF layer ──────────────────────────────────────────────────────────────

async function _processGeoTiffLayer(tifFile, layersDir, allSettings) {
  const id       = uuidv4();
  const layerDir = path.join(layersDir, id);
  await fs.mkdir(layerDir, { recursive: true });

  const settings = allSettings[tifFile.originalname] ?? {};
  const meta     = createLayerMeta({ id, originalName: tifFile.originalname, fileType: 'geotiff', options: settings });

  const ext      = path.extname(tifFile.originalname).toLowerCase() || '.tif';
  const mainFile = `${id}${ext}`;
  await fs.writeFile(path.join(layerDir, mainFile), tifFile.buffer);

  if (settings.keepOriginal) {
    const backupName = `original_${id}${ext}`;
    await fs.writeFile(path.join(layerDir, backupName), tifFile.buffer);
    meta.originalBackup = backupName;
  }

  const wantsCOG = settings.optimize === 'cog';
  const step     = wantsCOG
    ? 'GeoTIFF saved — COG conversion queued (will be optimised in the background)'
    : 'GeoTIFF stored as-is (enable "Optimise as COG" for better streaming performance)';

  meta.processingLog = [step];
  meta.status        = wantsCOG ? 'optimizing' : 'ready';
  if (wantsCOG) {
    meta.optimizationType = 'cog';
    if (settings.cogOptions) meta.cogOptions = settings.cogOptions;
  }
  if (settings.keepOriginal) meta.keepOriginal = true;
  await writeLayerMeta(layersDir, id, meta);

  return {
    id,
    type:             'geotiff',
    originalName:     tifFile.originalname,
    displayName:      meta.layerConfig.displayName,
    dataPath:         `data/layers/${id}/${mainFile}`,
    steps:            meta.processingLog,
    status:           meta.status,
    optimizationType: meta.optimizationType ?? null,
  };
}

// ── CSV layer ──────────────────────────────────────────────────────────────────

async function _processCsvLayer(csvFile, layersDir, allSettings) {
  const settings    = allSettings[csvFile.originalname] ?? {};
  const csvSettings = settings.csvSettings ?? {};
  const xCol        = csvSettings.xColumn ?? '';
  const yCol        = csvSettings.yColumn ?? '';

  if (!xCol || !yCol) {
    throw new Error(`${csvFile.originalname}: X and Y column names must be specified.`);
  }

  // Parse CSV
  const text  = csvFile.buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error(`${csvFile.originalname}: CSV has no data rows.`);

  const rawHeader = lines[0];
  const delim     = rawHeader.includes(';') ? ';' : ',';
  const headers   = rawHeader.split(delim).map(h => h.trim().replace(/^"|"$/g, ''));

  const xIdx = headers.indexOf(xCol);
  const yIdx = headers.indexOf(yCol);
  if (xIdx === -1) throw new Error(`${csvFile.originalname}: column "${xCol}" not found.`);
  if (yIdx === -1) throw new Error(`${csvFile.originalname}: column "${yCol}" not found.`);

  const features = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const x = parseFloat(cells[xIdx]);
    const y = parseFloat(cells[yIdx]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;  // skip bad rows

    const props = {};
    headers.forEach((h, idx) => { if (idx !== xIdx && idx !== yIdx) props[h] = cells[idx] ?? ''; });

    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: props });
  }

  const geojson = { type: 'FeatureCollection', features };

  const id       = uuidv4();
  const layerDir = path.join(layersDir, id);
  await fs.mkdir(layerDir, { recursive: true });

  // Apply optional processing (reproject / simplify) via shapeProcessor
  const { geojson: processed, steps: procSteps, sourceCrs, targetCrs } = processGeoJsonObject(geojson, {
    ...(settings.shapeSettings ?? {}),
    sourceCrs: csvSettings.crs || null,
  });

  if (settings.keepOriginal) {
    const backupName = `original_${id}.csv`;
    await fs.writeFile(path.join(layerDir, backupName), csvFile.buffer);
  }

  await fs.writeFile(path.join(layerDir, `${id}.geojson`), JSON.stringify(processed));

  const meta = createLayerMeta({
    id,
    originalName: csvFile.originalname,
    fileType:     'geojson',
    options:      { ...settings, sourceFormat: 'csv', xColumn: xCol, yColumn: yCol },
  });
  // Override: stored file is .geojson even though it came from a .csv
  meta.extension    = '.geojson';
  meta.featureCount = processed.features?.length ?? features.length;
  meta.sourceCrs    = sourceCrs ?? null;
  meta.targetCrs    = targetCrs ?? null;
  meta.featureIndex = processed.features?.map((f, i) => ({ id: f.properties?._featureId ?? null, index: i })) ?? null;
  if (settings.keepOriginal) meta.originalBackup = `original_${id}.csv`;
  const csvStep = `Converted ${features.length} rows from CSV to GeoJSON Points`;
  meta.processingLog = [csvStep, ...procSteps];
  await writeLayerMeta(layersDir, id, meta);

  return { id, filename: csvFile.originalname, type: 'geojson', dataPath: `data/layers/${id}/${id}.geojson`, featureCount: meta.featureCount, sourceCrs, targetCrs, steps: meta.processingLog };
}

// ── Sub-file addition (for POST /admin/layers/:id/subfiles) ───────────────────

export async function addSubFile(layerId, file, role, layersDir) {
  const meta     = await readLayerMeta(layersDir, layerId);
  const layerDir = path.join(layersDir, layerId);
  const subId    = uuidv4();
  const ext      = path.extname(file.originalname).toLowerCase() || '';
  const outFile  = `${subId}${ext}`;
  await fs.writeFile(path.join(layerDir, outFile), file.buffer);

  const subMeta = createSubFileMeta({
    id:           subId,
    originalName: file.originalname,
    fileType:     classifyExt(file.originalname) !== 'unknown' ? classifyExt(file.originalname) : ext.slice(1) || 'binary',
    role,
  });
  meta.subFiles.push(subMeta);
  await writeLayerMeta(layersDir, layerId, meta);

  return { subId, filename: outFile, dataPath: `data/layers/${layerId}/${outFile}`, role, meta: subMeta };
}

// ── Legacy re-link helper (kept for backward compatibility) ───────────────────

export async function relinkGeojson(filePath, layersDir) {
  const raw = await fs.readFile(filePath, 'utf8');
  let geojson;
  try { geojson = JSON.parse(raw); }
  catch { throw new Error(`Could not parse ${path.basename(filePath)} as JSON.`); }

  const modelMap      = new Map();
  const pointcloudMap = new Map();

  try {
    const layerDirs = await fs.readdir(layersDir, { withFileTypes: true });
    for (const entry of layerDirs) {
      if (!entry.isDirectory()) continue;
      const files = await fs.readdir(path.join(layersDir, entry.name)).catch(() => []);
      for (const f of files) {
        if (/\.(obj|ply|stl)$/i.test(f)) modelMap.set(path.parse(f).name, `data/layers/${entry.name}/${f}`);
        if (/\.(las|laz)$/i.test(f))     pointcloudMap.set(path.parse(f).name, `data/layers/${entry.name}/${f}`);
      }
    }
  } catch { /* no layers dir yet */ }

  const { geojson: linked, linkedCount, linkedAssets } = linkAssetsToFeatures(geojson, modelMap, pointcloudMap);
  await fs.writeFile(filePath, JSON.stringify(linked), 'utf8');

  return {
    filename:             path.basename(filePath),
    linkedCount,
    linkedAssets,
    availableModels:      modelMap.size,
    availablePointclouds: pointcloudMap.size,
  };
}

