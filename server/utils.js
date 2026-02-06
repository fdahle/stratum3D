import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Helper to normalize filenames (lowercase, spaces to underscores)
export const normalizeFilename = (filename) => {
  return filename.toLowerCase().replace(/\s+/g, "_");
};

// Helper to copy a file from source to destination with normalization
export const copyFile = (sourceDir, sourceFilename, destDir) => {
  const normalizedFilename = normalizeFilename(sourceFilename);
  let sourcePath = path.join(sourceDir, sourceFilename);
  
  // If original filename doesn't exist, try the normalized version
  if (!fs.existsSync(sourcePath)) {
    sourcePath = path.join(sourceDir, normalizedFilename);
    if (!fs.existsSync(sourcePath)) {
      return null;
    }
  }
  
  const destPath = path.join(destDir, normalizedFilename);
  fs.copyFileSync(sourcePath, destPath);
  return normalizedFilename;
};

// Helper to extract texture filenames from MTL file
export const extractTexturesFromMTL = (mtlPath) => {
  if (!fs.existsSync(mtlPath)) return [];

  const mtlContent = fs.readFileSync(mtlPath, "utf-8");
  const textureMatches = mtlContent.match(
    /(?:map_Kd|map_Ka|map_Ks|map_Ns|map_d|map_bump|bump)\s+(.+)/gi,
  );

  if (!textureMatches) return [];

  return textureMatches.map((match) => match.split(/\s+/)[1].trim());
};

// Helper to copy 3D model and its supporting files (OBJ, MTL, textures)
export const copy3DModelWithDependencies = (modelFilename, modelsInputDir, modelsOutputDir) => {
  const normalizedFilename = normalizeFilename(modelFilename);
  const ext = path.extname(normalizedFilename).toLowerCase();

  // Copy the main model file
  const copiedFile = copyFile(modelsInputDir, modelFilename, modelsOutputDir);
  if (!copiedFile) return null;

  const copiedFiles = [copiedFile];
  const originalBaseName = path.basename(modelFilename, path.extname(modelFilename));
  const normalizedBaseName = path.basename(normalizedFilename, ext);

  // Handle OBJ files - copy associated MTL and textures
  if (ext === ".obj") {
    const mtlFilename = originalBaseName + ".mtl";
    const copiedMtl = copyFile(modelsInputDir, mtlFilename, modelsOutputDir);
    if (copiedMtl) {
      copiedFiles.push(copiedMtl);
      // Copy textures referenced in MTL
      const mtlPath = path.join(modelsInputDir, normalizeFilename(mtlFilename));
      const textures = extractTexturesFromMTL(mtlPath);
      textures.forEach((texture) => {
        const copiedTexture = copyFile(modelsInputDir, texture, modelsOutputDir);
        if (copiedTexture) copiedFiles.push(copiedTexture);
      });
    }
  }

  console.log(`  - Copied 3D model: ${copiedFiles.join(", ")}`);
  return copiedFile;
};

// Helper to apply template strings (e.g. "{id}.jpg" -> "123.jpg")
export const applyTemplate = (template, properties) => {
  if (!template) return null;
  let url = template;
  const placeholders = url.match(/{([^}]+)}/g) || [];
  placeholders.forEach((p) => {
    const key = p.replace(/{|}/g, "");
    url = url.replace(p, properties[key] || "");
  });
  return url;
};

// Helper to load CSV file and create a lookup map
export const loadCsvLookup = (inputDir, relativeCsvPath, keyColumn, delimiter = ",") => {
  const fullPath = path.resolve(inputDir, relativeCsvPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ! CSV file not found: ${fullPath}`);
    return null;
  }
  const rawCsv = fs.readFileSync(fullPath, "utf-8");
  const records = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: delimiter,
  });
  const lookup = new Map();
  records.forEach((row) => lookup.set(String(row[keyColumn]), row));
  return lookup;
};

// Helper to detect CRS from GeoJSON
export const detectCrs = (geojson) => {
  if (geojson.crs?.properties?.name) {
    const name = geojson.crs.properties.name;
    if (name.includes("CRS84")) return "EPSG:4326";
    const match = name.match(/EPSG::?(\d+)/);
    return match ? `EPSG:${match[1]}` : name;
  }
  return "EPSG:4326";
};
