# 3D Viewer Documentation

## Overview

The 3D viewer component provides interactive visualization of 3D models, point clouds, and camera positions in a Three.js-based environment. The viewer features a QGIS-style ribbon menu for easy access to data loading and view controls.

## Features

### Ribbon Menu

The ribbon menu is located at the top of the 3D view and organizes functionality into three tabs:

#### Insert Tab
- **3D Model**: Load 3D models (.obj, .ply, .stl formats)
- **Point Cloud**: Load point cloud data (.copc.laz, .laz, .las, .ply formats)
- **Cameras**: Load camera positions from cameras.txt file

#### View Tab
- **Wireframe**: Toggle wireframe rendering mode
- **Bounding Box**: Show/hide bounding box around models
- **Grid**: Toggle reference grid
- **Reset View**: Reset camera to default position
- **Fit to Scene**: Automatically frame all content in view

#### Tools Tab
- **Distance**: Measure distances between points (coming soon)
- **Area**: Measure surface areas (coming soon)

## Supported File Formats

### 3D Models
- **.obj**: Wavefront OBJ format with material support
- **.ply**: Stanford PLY format (both ASCII and binary)
- **.stl**: STL format (coming soon)

### Point Clouds
- **.ply**: Stanford PLY point clouds with color support
- **.laz/.las**: LAS/LAZ format (requires server-side preprocessing to COPC)
- **.copc.laz**: Cloud Optimized Point Cloud format (requires Giro3D integration)

### Camera Files
- **cameras.txt**: Plain text camera definition file

## Camera File Format

The `cameras.txt` file supports two formats:

### Format 1: Quaternion Rotation
```
camera_name x y z qw qx qy qz
```

### Format 2: Euler Angles (degrees)
```
camera_name x y z roll pitch yaw
```

Example:
```
camera_01 1234.5 5678.9 123.4 0.707 0 0.707 0
camera_02 2345.6 6789.0 234.5 45.0 30.0 90.0
```

## Coordinate System

The viewer uses Three.js conventions:
- **Y-up**: Y-axis points upward
- **Right-handed**: Positive Z points toward viewer
- **Automatic conversion**: GIS Z-up models are automatically rotated to Y-up

Input data (models, point clouds, cameras) should use standard GIS coordinates (Z-up), which will be automatically converted.

## Loading Data

### From URL (via route parameters)
Navigate to `/3d-view` with query parameters:
```
/3d-view?models=url1.obj,url2.obj&pointclouds=cloud1.ply&x=1234&y=5678&name=Site_A
```

### From File (via ribbon menu)
1. Click the **Insert** tab in the ribbon menu
2. Select the appropriate data type button
3. Choose file(s) from your computer
4. Data loads with progress indication

## Loading Progress

The viewer shows detailed loading progress:
- **Downloading**: Shows download progress with MB transferred
- **Decoding**: Indicates data decompression
- **Parsing**: Shows parsing progress for large files (chunked processing)
- **Building Geometry**: Indicates GPU buffer creation and normal computation

## Point Cloud Rendering

### PLY Point Clouds
- Loaded directly in browser using Three.js PLYLoader
- Supports vertex colors from PLY file
- Default gray color applied if no colors present
- Point size: 0.05 units with size attenuation

### LAZ/LAS Point Clouds
- Requires server-side preprocessing to COPC format
- Use the preprocessing pipeline: `npm run preprocess`
- See `/server/README_PREPROCESSING.md` for details

### COPC Point Clouds
- Future support via Giro3D integration
- Will enable streaming of large point clouds

## Camera Visualization

Cameras loaded from `cameras.txt` are rendered as:
- **Frustum**: Blue wireframe showing camera field of view
- **Label**: Camera name displayed above frustum
- **FOV**: 60° horizontal field of view (default)
- **Aspect**: 4:3 aspect ratio (default)

## Performance Optimization

### Large Models
Models larger than 100MB should be preprocessed:
```bash
cd server
npm run preprocess
```

This will:
- Decimate models to ~1M vertices
- Convert point clouds to COPC format
- Optimize for web delivery

### Progressive Loading
The viewer uses progressive loading for OBJ files:
- Processes 10,000 lines per chunk
- Yields to browser every chunk
- Keeps UI responsive during parsing

## Component Architecture

### Main Components
- **3DView.vue**: Main view orchestrator with loading progress
- **RibbonMenu.vue**: QGIS-style ribbon interface
- **Canvas.vue**: Three.js scene and rendering logic
- **Controls.vue**: Legacy side panel (still available)
- **MeasurementTools.vue**: Distance and area measurement UI

### Composables
- **useViewer3D.js**: Shared 3D viewer state and utilities

## API Reference

### Canvas Component Methods

```javascript
// Exposed via ref
const canvas = ref(null);

// Load 3D model from file
canvas.value.loadUserObjFile(file: File)

// Load 3D model from URL
canvas.value.loadModelFromUrl(url: string, index: number)

// Load point cloud from file
canvas.value.loadPointCloudFile(file: File)

// Load cameras from file
canvas.value.loadCamerasFile(file: File)

// Fit camera to scene content
canvas.value.fitCameraToScene()

// Enable measurement mode
canvas.value.enableMeasurementMode(mode: 'distance' | 'area')

// Disable measurement mode
canvas.value.disableMeasurementMode()
```

### Canvas Component Events

```javascript
<Canvas
  @scene-ready="onSceneReady()"
  @model-loaded="onModelLoaded({ url, index })"
  @loading-error="onLoadingError({ url, error })"
  @loading-progress="onLoadingProgress({ url, index, loaded, total, progress, status })"
  @parsing-started="onParsingStarted({ index, size })"
  @parsing-progress="onParsingProgress({ index, progress, processed, total })"
  @building-geometry="onBuildingGeometry({ index, stage, vertices, faces, triangles })"
/>
```

## Troubleshooting

### Model appears rotated
- Models using Z-up convention are automatically rotated to Three.js Y-up
- If incorrect, check coordinate system in source data

### Point cloud not loading
- Check file extension (.ply supported directly, .laz/.las require preprocessing)
- Verify PLY file is valid (try opening in CloudCompare or MeshLab)
- Check browser console for specific error messages

### Camera frustums not appearing
- Verify cameras.txt format matches specification
- Check coordinate system (Z-up values are converted to Y-up)
- Ensure camera positions are within scene bounds

### Performance issues
- Preprocess large models with decimation
- Reduce point cloud density using PDAL
- Enable level-of-detail (LOD) in future Giro3D integration

## Future Enhancements

- [ ] Giro3D integration for COPC streaming
- [ ] STL model format support
- [ ] Advanced measurement tools (distance, area, volume)
- [ ] Multiple point cloud rendering modes (intensity, classification)
- [ ] Camera animation paths
- [ ] Model annotations and labels
- [ ] Export capabilities (screenshots, measurements)
- [ ] Virtual reality (VR) support
