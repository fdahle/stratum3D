# Folder Structure Guide

## Current Structure ✅

Your current structure is **excellent** and follows best practices:

```
hist_map/
├── input/                    # Raw source data (not served to web)
│   ├── shapes/              # GeoJSON, Shapefiles (.shp, .json, .geojson)
│   ├── models/              # 3D models (.obj, .mtl, textures)
│   ├── pointclouds/         # Point cloud files (.las, .laz, .ply)
│   ├── geotiffs/            # 🆕 GeoTIFF rasters (.tif, .tiff)
│   ├── attributes/          # CSV files for attribute joining
│   ├── cameras/             # Camera position files
│   └── input_config.json    # Mapping configuration
│
├── server/
│   ├── data/                # ✨ Processed & optimized data (served to web)
│   │   ├── layers/         # Optimized GeoJSON files
│   │   ├── 3D/             # Decimated 3D models
│   │   ├── pointclouds/    # COPC point clouds
│   │   └── geotiffs/       # 🆕 Cloud Optimized GeoTIFFs (COG)
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

## Why This Structure is Optimal

### ✅ Separation of Concerns
- **`input/`** = Raw, unprocessed source data
- **`server/data/`** = Web-optimized, production-ready data
- Clear boundary between source and served data

### ✅ Security
- `input/` folder is **not exposed** to the web server
- Only optimized `data/` is served publicly
- Protects original high-resolution files

### ✅ Performance
- Client only downloads optimized files
- Large files are automatically processed
- COG/COPC formats enable streaming

### ✅ Version Control
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
Edit `server/preprocess_config.json`:
```json
{
  "shapes": {
    "targetCrs": "EPSG:3031",
    "simplifyTolerance": 50
  },
  "geotiffs": {
    "enabled": true,
    "targetCrs": "EPSG:3031",
    "optimization": {
      "createCOG": true,
      "compression": "DEFLATE"
    }
  }
}
```

### 3. Run Preprocessing
```bash
cd server
npm run preprocess
```

### 4. Reference in Config
In `client/public/config.yaml`:
```yaml
overlay_layers:
  - name: "Satellite Imagery"
    type: geotiff
    url: "http://localhost:3000/data/geotiffs/satellite.tif"
    visible: true
    opacity: 0.8
```

## GeoTIFF Processing Features 🆕

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

### GeoTIFF Optimization
1. **Use COG format** for web delivery (enabled by default)
2. **Match CRS** to your base map projection
3. **Add compression** to reduce file size
4. **Generate overviews** for multi-scale viewing

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

## Required Tools

### For GeoTIFF Processing (Optional but Recommended)
```bash
# macOS
brew install gdal

# Ubuntu/Debian
sudo apt-get install gdal-bin

# Windows
# Download from: https://gdal.org/download.html
```

Without GDAL, files are copied as-is (no optimization).

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

## Migration Notes

If you have existing GeoTIFFs in other locations:
1. Create `input/geotiffs/` folder
2. Copy original TIF files there
3. Run `npm run preprocess`
4. Update URLs in `config.yaml` to point to `/data/geotiffs/`

## Summary

✨ **Your structure is already optimized!** The addition of GeoTIFF support maintains the same excellent pattern:
- Raw data in `input/`
- Processed data in `server/data/`
- Clear separation and security
- Automated optimization pipeline

No changes needed to your existing structure! 🎉
