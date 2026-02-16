# Preprocessing Pipeline

This preprocessing system handles large 3D models, shapefiles, and point clouds for optimal web rendering.

## Features

### 3D Models
- **Automatic Decimation**: Reduces vertex count of large models
- **Multiple Tool Support**: Uses MeshLab or Blender
- **Material Preservation**: Automatically copies MTL files and textures
- **Z-up Conversion**: Handles GIS coordinate systems

### Point Clouds
- **COPC Conversion**: Cloud Optimized Point Cloud format
- **Automatic Thinning**: Reduces density for large clouds
- **CRS Reprojection**: Transform coordinates
- **Streaming-ready**: Optimized for web delivery

### Shapefiles
- **CRS Reprojection**: Convert to target projection
- **Simplification**: Reduce complexity
- **Attribute Joining**: Merge CSV data

## Installation

### For 3D Model Processing

Install **one** of these tools:

#### MeshLab (Recommended for batch processing)
```bash
# macOS
brew install meshlab

# Ubuntu/Debian
sudo apt-get install meshlab

# Windows
# Download from https://www.meshlab.net/
```

#### Blender (More features, slower)
```bash
# macOS
brew install blender

# Ubuntu/Debian
sudo snap install blender --classic

# Windows
# Download from https://www.blender.org/
```

### For Point Cloud Processing (COPC)

Install **PDAL** (recommended):

```bash
# macOS
brew install pdal

# Ubuntu/Debian
sudo apt-get install pdal libpdal-dev

      "targetFileSize": 100,
      "preserveUVs": true,
      "preserveNormals": true
    }
  },
  "pointclouds": {
    "enabled": true,
    "sourceCrs": "EPSG:4326",
    "targetCrs": "EPSG:3031",
    "thinning": {
      "enabled": true,
      "maxPoints": 10000000,
      "radius": 0.5
    }
  }
}
```

### 3D Model Configuration
  processors/
    modelProcessor.js        # 3D model decimation
    pointcloudProcessor.js   # COPC conversion & thinning
  preprocess.js              # Main pipeline
  preprocess_config.json     # Configuration
```

## Configuration

Edit `preprocess_config.json` to customize processing:

```json
{
  "models3D": {
    "enabled": true,
    "decimation": {
      "enabled": true,
      "targetVertices": 1000000,      // Reduce to this many vertices
    3D Model Configuration

#### `targetVertices`
Maximum number of vertices in output model. Good values:
- **50,000**: Low detail, fast loading
- **250,000**: Medium detail, good balance
- **1,000,000**: High detail, slower loading (default)
- **5,000,000**: Very high detail, use only if necessary

#### `targetFileSize`
Maximum file size in MB. Files larger than this will be decimated.

#### `preserveUVs` / `preserveNormals`
Keep texture coordinates and surface normals. Usually `true`.

### Point Cloud Configuration

#### `maxPoints`
Maximum points before thinning. Good values:
- **1,000,000**: Small, fast loading
- **5,000,000**: Medium detail
- **10,000,000**: High detail (default)
- **50,000,000**: Very high detail

#### `radius`
Thinning radius in meters - keeps one point per radius:
- **0.1**: Very dense (high detail)
- **0.5**: Balanced (default)
- **1.0**: Sparse (low detail)

#### `sourceCrs` / `targetCrs`
Source and target coordinate systems (EPSG codes)y

#### `targetFileSize`
Maximum file size in MB. Files larger than this will be decimated.

#### `preserveUVs`
Keep texture coordinates. Set to `true` if model has textures.
are-data
```

This will process:
- All shapefiles in `../input/shapes/`
- All 3D models (.obj) in `../input/models/`
- All point clouds (.las/.laz) in `../input/pointclouds/`

### Process Only Specific Types

```bash
# Edit preprocess_config.json to disable unwanted types
{
  "mglacier.obj               # 1.6GB, 15M vertices
    glacier.mtl
  pointclouds/
    survey.laz                # 2GB, 50M points
    lidar.copc.laz            # Already COPC
    
server/
  data/
    3D/
      glacier_decimated.obj   # 50MB, 1M vertices
    pointclouds/
      survey.copc.laz         # 800MB, 10M points (COPC)
      lidar.copc.laz          # Copied as-is
```

## Processing Examples

### Large 3D Model (15M vertices)
Put your `.obj` files in `../input/models/` and run:
```bash
node preprocess.js
```

### File Structure
```
input/
  models/
    my_large_model.obj      # 1.6GB, 15M vertices
    my_large_model.mtl      # Material file
### Large 3D Model (15M vertices)

1. **Place model**:
   ```bash
   cp glacier.obj ../input/models/
   ```

2. **Configure** (optional):
   ```json
   {
     "models3D": {
       "decimation": {
         "targetVertices": 1000000
       }
     }
   }
   ```

3. **Process**:
   ```bash
   cd server
   npm run prepare-data
   ```

4. **Result**:
   - Input: `1.6GB`, `15M vertices`
   - Output: `~50-100MB`, `1M vertices` (93% reduction)

### Large Point Cloud (50M points)

1. **Place point cloud**:
   ```bash
   cp survey.laz ../input/pointclouds/
   ```

2. **Configure**:
   ```json
   {).

### "PDAL not detected"
Install PDAL for point cloud processing (see Installation).

### Models look blocky
Increase `targetVertices` in config.

### Point cloud too sparse
Decrease `thinning.radius` (e.g., `0.1` instead of `0.5`).

### Process is too slow
- Use MeshLab instead of Blender for models
- Reduce target vertices/points
- Process files individually

### Out of memory
- Lower target vertices/points
- Use specialized tools first
- Split into smaller chunks
   cd server
   node preprocess.js
   ```

3. **Result**: 
   - Input: `1.6GB`, `15M vertices`
   - Output: `~50-100MB`, `1M vertices`
   - Reduction: `~93%` vertices, `~94%` file size

## Troubleshooting
### 3D Models
1. **Start conservative**: Begin with higher vertex counts
2. **Test in browser**: Check result before further reduction
3. **Keep originals**: Source files are never modified
4. **Monitor output**: Check console for reduction stats

### Point Clouds
1. **Use COPC**: Best format for web streaming
2. **Thin appropriately**: Balance detail vs. performance
3. **Check CRS**: Ensure coordinates match your map
4. **Test loading**: Verify in browser before deployment

## Performance Guidelines

### 3D Models

| Model Size | Vertices | Load Time | Performance |
|------------|----------|-----------|-------------|
| Small      | < 50K    | < 1s      | Excellent   |
| Medium     | 50K-250K | 1-3s      | Good        |
| Large      | 250K-1M  | 3-10s     | Fair        |
| Very Large | 1M-5M    | 10-30s    | Slow        |

### Point Clouds (COPC)

| Size       | Points   | Load Time | Performance |
|------------|----------|-----------|-------------|
| Small      | < 1M     | < 2s      | Excellent   |
| Medium     | 1M-5M    | 2-5s      | Good        |
| Large      | 5M-20M   | 5-15s     | Fair        |
| Very Large | 20M-50M  | 15-30s    | Slow        |

**Note**: COPC streams progressively, so large files start displaying quickly!

For future implementation, you can enable multiple quality levels:

```json
{Full Example

```bash
# 1. Place your data
cp my_glacier.obj ../input/models/
cp survey.laz ../input/pointclouds/

# 2. Configure (optional)
nano preprocess_config.json

# 3. Install tools
brew install meshlab pdal

# 4. Process everything
cd server
npm run prepare-data

# Output:
# === Processing Shapes ===
# (processes any shapefiles)
#
# === Processing 3D Models ===
# Processing 3D model: my_glacier.obj
#   - Size: 1600.00 MB
#   - Estimated vertices: 15,000,000
#   - Attempting decimation with MeshLab (target: 1,000,000 vertices)...
#   ✓ Decimation complete!
#     Original: 1600.00 MB
#     Decimated: 85.34 MB (94.7% reduction)
#
# === Processing Point Clouds ===
# Processing point cloud: survey.laz
#   - Size: 2.00 GB
#   - Reading point cloud metadata...
#     Points: 50,000,000
#   - Point cloud exceeds 10,000,000 points, thinning...
#   ✓ Processing complete!
#     Original: 2.00 GB, 50,000,000 points
#     Processed: 0.80 GB, 10,000,000 points
#     Point reduction: 80.0%
```

Your data is now optimized for web deliverymended |

## Example: Processing Your 15M Vertex Model

```bash
# 1. Place your model
cp my_glacier.obj ../input/models/
cp my_glacier.mtl ../input/models/
cp texture.jpg ../input/models/

# 2. Configure (optional, defaults are good)
nano preprocess_config.json

# 3. Process
node preprocess.js

# Output:
# Processing 3D model: my_glacier.obj
#   - Size: 1600.00 MB
#   - Estimated vertices: 15,000,000
#   - Attempting decimation with MeshLab (target: 1,000,000 vertices)...
#   ✓ Decimation complete!
#     Original: 1600.00 MB
#     Decimated: 85.34 MB (94.7% reduction)
```

Your model is now ready to use in the 3D viewer! 🎉
