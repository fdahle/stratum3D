import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Helper to normalize filenames (lowercase, spaces to underscores)
export const normalizeFilename = (filename) => {
  return filename.toLowerCase().replace(/\s+/g, "_");
};

/**
 * Generate a unique filename by prefixing with feature ID
 * This prevents name collisions when multiple features reference files with the same name
 * @param {string} originalFilename - Original filename from template
 * @param {string} featureId - Unique feature identifier
 * @returns {string} Unique filename: featureId_originalFilename
 */
export const makeUniqueFilename = (originalFilename, featureId) => {
  const normalized = normalizeFilename(originalFilename);
  const ext = path.extname(normalized);
  const baseName = path.basename(normalized, ext);
  
  // Create unique filename: featureId_baseName.ext
  // This ensures files from different features never conflict
  return `${featureId}_${baseName}${ext}`;
};

// Helper to copy a file from source to destination with unique naming
export const copyFile = (sourceDir, sourceFilename, destDir, featureId = null) => {
  const normalizedFilename = normalizeFilename(sourceFilename);
  let sourcePath = path.join(sourceDir, sourceFilename);
  
  // If original filename doesn't exist, try the normalized version
  if (!fs.existsSync(sourcePath)) {
    sourcePath = path.join(sourceDir, normalizedFilename);
    if (!fs.existsSync(sourcePath)) {
      return null;
    }
  }
  
  // Generate unique destination filename if featureId is provided
  const destFilename = featureId 
    ? makeUniqueFilename(normalizedFilename, featureId)
    : normalizedFilename;
  
  const destPath = path.join(destDir, destFilename);
  
  // Skip if already copied (avoid redundant copies in same preprocessing run)
  if (fs.existsSync(destPath)) {
    return destFilename;
  }
  
  fs.copyFileSync(sourcePath, destPath);
  return destFilename;
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
export const copy3DModelWithDependencies = (modelFilename, modelsInputDir, modelsOutputDir, featureId = null) => {
  const normalizedFilename = normalizeFilename(modelFilename);
  const ext = path.extname(normalizedFilename).toLowerCase();

  // Copy the main model file with unique naming
  const copiedFile = copyFile(modelsInputDir, modelFilename, modelsOutputDir, featureId);
  if (!copiedFile) return null;

  const copiedFiles = [copiedFile];
  const originalBaseName = path.basename(modelFilename, path.extname(modelFilename));
  const normalizedBaseName = path.basename(normalizedFilename, ext);

  // Handle OBJ files - copy associated MTL and textures
  if (ext === ".obj") {
    const mtlFilename = originalBaseName + ".mtl";
    const copiedMtl = copyFile(modelsInputDir, mtlFilename, modelsOutputDir, featureId);
    
    if (copiedMtl) {
      copiedFiles.push(copiedMtl);
      
      // Update OBJ file to reference the new MTL filename
      const objPath = path.join(modelsOutputDir, copiedFile);
      updateObjMtlReference(objPath, copiedMtl);
      
      // Copy textures referenced in MTL
      const mtlPath = path.join(modelsInputDir, normalizeFilename(mtlFilename));
      const textures = extractTexturesFromMTL(mtlPath);
      
      textures.forEach((texture) => {
        const copiedTexture = copyFile(modelsInputDir, texture, modelsOutputDir, featureId);
        if (copiedTexture) copiedFiles.push(copiedTexture);
      });
      
      // Update MTL file to reference new texture filenames
      if (textures.length > 0) {
        const destMtlPath = path.join(modelsOutputDir, copiedMtl);
        updateMtlTextureReferences(destMtlPath, textures, featureId);
      }
    }
  }

  console.log(`  - Copied 3D model: ${copiedFiles.join(", ")}`);
  return copiedFile;
};

// Helper to update OBJ file's MTL reference
const updateObjMtlReference = (objPath, newMtlFilename) => {
  try {
    let content = fs.readFileSync(objPath, 'utf-8');
    // Replace mtllib line with new filename
    content = content.replace(/^mtllib\s+.+$/m, `mtllib ${newMtlFilename}`);
    fs.writeFileSync(objPath, content, 'utf-8');
  } catch (e) {
    console.warn(`  ! Could not update MTL reference in ${path.basename(objPath)}`);
  }
};

// Helper to update MTL file's texture references
const updateMtlTextureReferences = (mtlPath, originalTextures, featureId) => {
  try {
    let content = fs.readFileSync(mtlPath, 'utf-8');
    
    // Replace each texture reference with unique filename
    originalTextures.forEach(texture => {
      const normalized = normalizeFilename(texture);
      const uniqueName = makeUniqueFilename(normalized, featureId);
      
      // Replace all texture map references
      const textureTypes = ['map_Kd', 'map_Ka', 'map_Ks', 'map_Ns', 'map_d', 'map_bump', 'bump'];
      textureTypes.forEach(type => {
        const regex = new RegExp(`(${type}\\s+)${texture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
        content = content.replace(regex, `$1${uniqueName}`);
      });
    });
    
    fs.writeFileSync(mtlPath, content, 'utf-8');
  } catch (e) {
    console.warn(`  ! Could not update texture references in ${path.basename(mtlPath)}`);
  }
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
