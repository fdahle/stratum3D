# Project Architecture

This document explains the folder structure and file naming system of the hist_map project.

## Folder Structure

### Overview

Your project structure follows best practices with clear separation of concerns:

```
hist_map/
├── input/                    # Raw source data (not served to web)
│   ├── shapes/              # GeoJSON, Shapefiles (.shp, .json, .geojson)
│   ├── models/              # 3D models (.obj, .mtl, textures)
│   ├── pointclouds/         # Point cloud files (.las, .laz, .ply)
│   ├── geotiffs/            # GeoTIFF rasters (.tif, .tiff)
│   ├── attributes/          # CSV files for attribute joining
│   ├── cameras/             # Camera position files
│   └── input_config.json    # Mapping configuration
│
├── server/
│   ├── data/                # ✨ Processed & optimized data (served to web)
│   │   ├── layers/         # Optimized GeoJSON files
│   │   ├── 3D/             # Decimated 3D models
│   │   ├── pointclouds/    # COPC point clouds
│   │   └── geotiffs/       # Cloud Optimized GeoTIFFs (COG)
│   │
│   ├── processors/
│   │   ├── modelProcessor.js
│   │   └── pointcloudProcessor.js
│   │
│   ├── preprocess.js        # Main preprocessing pipeline
│   ├── preprocess_config.json
│   ├── index.js             # Express server
│   └── utils.js
│
└── client/                   # Vue.js frontend application
    └── public/
        └── config.yaml      # Map configuration
```

### Why This Structure is Optimal

#### ✅ Separation of Concerns
- **`input/`** = Raw, unprocessed source data
- **`server/data/`** = Web-optimized, production-ready data
- Clear boundary between source and served data

#### ✅ Security
- `input/` folder is **not exposed** to the web server
- Only optimized `data/` is served publicly
- Protects original high-resolution files

#### ✅ Performance
- Client only downloads optimized files
- Large files are automatically processed
- COG/COPC formats enable streaming

#### ✅ Version Control
- Add `input/` to `.gitignore` (if files are large)
- Keep `data/` in git (if small) or regenerate via preprocessing
- Pipeline is reproducible

## Workflow

### 1. Add Raw Data
Place your source files in `input/` folders:
```bash
input/
├── shapes/mydata.geojson
├── models/glacier.obj
├── pointclouds/survey.las
└── geotiffs/satellite.tif
```

### 2. Configure Processing
Edit `server/preprocess_config.json` for technical settings and `input/input_config.json` for data source metadata.

### 3. Run Preprocessing
```bash
cd server
npm run preprocess
```

### 4. Reference in Config
In `client/public/config.yaml`, reference the processed files:
```yaml
overlay_layers:
  - name: "My Layer"
    type: geojson
    url: "http://localhost:3000/data/layers/mydata.geojson"
    visible: true
```

## File Naming System

### Problem
When multiple features reference files with the same name (e.g., multiple glaciers each with `model.obj`), the preprocessing script would overwrite files, causing only the last feature to display correctly.

### Solution
**Automatic Unique Naming** - The system now prefixes files with a short feature ID during preprocessing:

```
Original:        model.obj
After processing: a3f5b2c8_model.obj
                  ^^^^^^^^
                  Feature ID (8 chars)
```

### How It Works

#### 1. Feature ID Generation
Each GeoJSON feature gets a unique 8-character ID during preprocessing:

```javascript
const featureId = uuidv4().split('-')[0]; // e.g., "a3f5b2c8"
feature.properties._featureId = featureId;
```

#### 2. File Copying with Unique Names
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

#### 3. Reference Updates
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

### Configuration (No Changes Required!)

Your config stays simple - **no manual renaming needed**:

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

### Benefits

✅ **No naming conflicts** - Multiple features can have files with the same base name  
✅ **Simple config** - Templates remain clean and readable  
✅ **Traceable files** - Feature ID links files back to their source  
✅ **Automatic updates** - OBJ/MTL/texture references stay consistent  
✅ **No manual work** - Everything handled during preprocessing  

### File Structure Example

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

### When Uniqueness Applies

✅ **Used with feature ID:**
- 3D models (per feature)
- Point clouds (per feature)
- Any file referenced in feature properties

❌ **Not used (global files):**
- GeoJSON layers (one per layer definition)
- GeoTIFF rasters (standalone layers)
- Shared resources (not feature-specific)

## GeoTIFF Processing

### Automatic Optimization
- **Cloud Optimized GeoTIFF (COG)** creation
- Internal tiling for fast streaming
- Compression (DEFLATE, LZW, JPEG)
- Automatic overview generation

### CRS Reprojection
Automatically transforms to your target projection:
```bash
# Before: EPSG:4326 (WGS84)
# After:  EPSG:3031 (Antarctic Polar Stereographic)
```

### Performance Benefits
- **Streaming**: View without full download
- **Pyramids**: Fast zoom at all levels
- **Compression**: Smaller file sizes
- **Tiling**: Efficient partial reads

## Best Practices

### File Organization
```
input/geotiffs/
├── base/              # Base imagery layers
│   ├── landsat.tif
│   └── aerial.tif
├── overlays/          # Data overlays
│   ├── elevation.tif
│   └── temperature.tif
└── archive/           # Backup originals
```

### Preprocessing Tips
- Run preprocessing after adding new files
- Keep originals in `input/` (backup)
- Only commit optimized `data/` to git
- Use `.gitignore` for large input files

## Server Configuration

The Express server automatically serves all processed data:
```javascript
// server/index.js
app.use('/data', express.static(path.join(__dirname, 'data')));

// Access via:
// http://localhost:3000/data/geotiffs/satellite.tif
// http://localhost:3000/data/layers/coastline.geojson
// http://localhost:3000/data/3D/glacier.obj
```
