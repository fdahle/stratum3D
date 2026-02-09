# File Naming System

## Problem
When multiple features reference files with the same name (e.g., multiple glaciers each with `model.obj`), the preprocessing script would overwrite files, causing only the last feature to display correctly.

## Solution
**Automatic Unique Naming** - The system now prefixes files with a short feature ID during preprocessing:

```
Original:        model.obj
After processing: a3f5b2c8_model.obj
                  ^^^^^^^^
                  Feature ID (8 chars)
```

## How It Works

### 1. Feature ID Generation
Each GeoJSON feature gets a unique 8-character ID during preprocessing:

```javascript
const featureId = uuidv4().split('-')[0]; // e.g., "a3f5b2c8"
feature.properties._featureId = featureId;
```

### 2. File Copying with Unique Names
When copying files, the system automatically prefixes them with the feature ID:

```javascript
// utils.js
export const makeUniqueFilename = (originalFilename, featureId) => {
  const normalized = normalizeFilename(originalFilename);
  const ext = path.extname(normalized);
  const baseName = path.basename(normalized, ext);
  
  return `${featureId}_${baseName}${ext}`;
};
```

**Examples:**
```
Feature ID: a3f5b2c8
crane_glacier.obj → a3f5b2c8_crane_glacier.obj
crane_glacier.mtl → a3f5b2c8_crane_glacier.mtl
texture.jpg       → a3f5b2c8_texture.jpg

Feature ID: d7e9f1a2
crane_glacier.obj → d7e9f1a2_crane_glacier.obj  ← Different file!
```

### 3. Reference Updates
For OBJ models with dependencies (MTL + textures), the system automatically updates internal references:

**Original OBJ:**
```obj
mtllib crane_glacier.mtl
```

**After Processing:**
```obj
mtllib a3f5b2c8_crane_glacier.mtl
```

**Original MTL:**
```mtl
map_Kd texture.jpg
```

**After Processing:**
```mtl
map_Kd a3f5b2c8_texture.jpg
```

## Configuration (No Changes Required!)

Your config.yaml stays simple - **no manual renaming needed**:

```yaml
layers:
  - name: Glaciers
    source: glaciers.geojson
    3DModels:
      - linkTemplate: "{model}.obj"     # ← Still use simple template!
    pointclouds:
      - linkTemplate: "{pointcloud}.laz"
```

The system:
1. Resolves `{model}` → `crane_glacier.obj`
2. Copies with unique name → `a3f5b2c8_crane_glacier.obj`
3. Updates URL in GeoJSON → `data/3D/a3f5b2c8_crane_glacier.obj`
4. Updates MTL/texture references automatically

## Benefits

✅ **No naming conflicts** - Multiple features can have files with the same base name  
✅ **Simple config** - Templates remain clean and readable  
✅ **Traceable files** - Feature ID links files back to their source  
✅ **Automatic updates** - OBJ/MTL/texture references stay consistent  
✅ **No manual work** - Everything handled during preprocessing  

## File Structure

```
input/
  models/
    crane_glacier.obj      ← Original files (any name)
    crane_glacier.mtl
    texture.jpg

server/data/
  3D/
    a3f5b2c8_crane_glacier.obj  ← Unique names (no conflicts)
    a3f5b2c8_crane_glacier.mtl
    a3f5b2c8_texture.jpg
    d7e9f1a2_crane_glacier.obj  ← Different feature, no collision!
```

## Implementation Details

### Functions

**`makeUniqueFilename(originalFilename, featureId)`**
- Generates unique filename by prefixing with feature ID
- Location: [server/utils.js](server/utils.js)

**`copyFile(sourceDir, sourceFilename, destDir, featureId)`**
- Copies file with optional unique naming
- If `featureId` provided → unique name
- If `featureId` null → normalized name only
- Location: [server/utils.js](server/utils.js)

**`copy3DModelWithDependencies(modelFilename, inputDir, outputDir, featureId)`**
- Copies OBJ + MTL + textures with unique names
- Updates all internal references (`.obj` → `.mtl`, `.mtl` → textures)
- Location: [server/utils.js](server/utils.js)

### When Uniqueness Applies

✅ **Used with feature ID:**
- 3D models (per feature)
- Point clouds (per feature)
- Any file referenced in feature properties

❌ **Not used (global files):**
- GeoJSON layers (one per layer definition)
- GeoTIFF rasters (standalone layers)
- Shared resources (not feature-specific)

## Debugging

### Find which feature owns a file:
```bash
# Extract feature ID from filename
# a3f5b2c8_model.obj → feature ID is a3f5b2c8

# Search in processed GeoJSON
grep -r "a3f5b2c8" server/data/layers/
```

### Check file mapping:
All processed GeoJSON files include `_featureId` in properties:
```json
{
  "type": "Feature",
  "properties": {
    "_featureId": "a3f5b2c8",
    "_model3dUrls": ["data/3D/a3f5b2c8_crane_glacier.obj"],
    "name": "Crane Glacier"
  }
}
```

## Migration

Existing processed files **will be regenerated** on next preprocessing run with unique names. No manual migration needed - just run:

```bash
npm run preprocess
# or
docker compose run --rm server npm run preprocess
```
