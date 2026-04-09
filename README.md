> [!WARNING]
> **This project is currently under heavy development.**
> Expect frequent breaking changes, bugs, and incomplete documentation.

# Stratum3D

A web-based geospatial visualization system with 3D model and point cloud support, designed for historical map data and geographical features.

## Features

- 📍 **Interactive 2D Maps** - OpenLayers-based mapping with custom CRS support
- 🗻 **3D Viewer** - Three.js-based 3D visualization of models and point clouds
- 📊 **Multi-format Support** - GeoJSON, 3D models (.obj, .ply), point clouds (.laz, .ply), GeoTIFFs
- ⚡ **Optimized Pipeline** - Automatic preprocessing and optimization for web delivery
- 🐳 **Docker Ready** - Complete containerized setup with all dependencies
- 🛠️ **Flexible Configuration** - YAML-based map config with per-feature 3D data links

## Quick Start

### Using Docker (Recommended)

The easiest way to get started - no need to install GDAL, PDAL, or other dependencies:

```bash
# Start the application
docker-compose up

# Access at:
# - Frontend: http://localhost:8080
# - Backend API: http://localhost:3000
```

For development with hot-reload:
```bash
docker-compose --profile dev up server client-dev
# Frontend dev server: http://localhost:5173
```

See [docs/docker.md](docs/docker.md) for complete Docker documentation.

### Manual Setup

#### Prerequisites
- Node.js 18+
- Optional: GDAL (for GeoTIFF processing)
- Optional: PDAL (for point cloud processing)
- Optional: MeshLab or Blender (for 3D model optimization)

#### Installation

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Start development servers
cd client && npm run dev    # Port 5173
cd server && npm start      # Port 3000
```

## Project Structure

```
hist_map/
├── input/              # Raw source data (GeoJSON, models, point clouds)
├── server/
│   ├── data/          # Processed & optimized data (served to client)
│   ├── preprocess.js  # Data preprocessing pipeline
│   └── index.js       # Express API server
├── client/            # Vue.js frontend application
│   └── public/
│       └── config.yaml # Map configuration
├── docs/              # Documentation
└── examples/          # Example configurations
```

See [docs/architecture.md](docs/architecture.md) for detailed structure explanation.

## Configuration

### Map Configuration

Edit `client/public/config.yaml` to configure your map:

```yaml
view:
  center: [51.505, -0.09]
  zoom: 13

crs: "EPSG3857"

base_layers:
  - name: "OpenStreetMap"
    type: "tile"
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    visible: true

overlay_layers:
  - name: "My Data"
    type: "geojson"
    url: "http://localhost:3000/data/shapes/mydata.geojson"
    visible: true
```

See `examples/config_london.yaml` for a complete example.

### Data Source Configuration

Edit `input/input_config.json` to configure data sources and 3D model links:

```json
{
  "shapes/myfile.geojson": {
    "metadata": {
      "has3DModels": true,
      "3DModels": [
        { "linkTemplate": "{model_name}.obj" }
      ]
    }
  }
}
```

See [docs/3d-data-config.md](docs/3d-data-config.md) for detailed 3D data configuration.

### Preprocessing Configuration

Edit `server/preprocess_config.json` to configure data optimization:

```json
{
  "models3D": {
    "decimation": {
      "targetVertices": 1000000
    }
  },
  "pointclouds": {
    "thinning": {
      "maxPoints": 10000000
    }
  }
}
```

See [docs/preprocessing.md](docs/preprocessing.md) for complete preprocessing documentation.

## Workflow

### 1. Add Your Data

Place raw data files in the `input/` folder:

```bash
input/
├── shapes/         # GeoJSON, Shapefiles
├── models/         # 3D models (.obj, .mtl, textures)
├── pointclouds/    # Point clouds (.las, .laz, .ply)
├── geotiffs/       # Raster imagery (.tif)
└── attributes/     # CSV files for attribute joining
```

### 2. Run Preprocessing

```bash
# Docker
docker-compose exec server npm run preprocess

# Manual
cd server && npm run preprocess
```

This will:
- Optimize and reproject GeoJSON
- Decimate large 3D models
- Convert point clouds to COPC format
- Create Cloud-Optimized GeoTIFFs

### 3. Configure Your Map

Edit `client/public/config.yaml` to reference your processed data.

### 4. View Your Map

Open http://localhost:8080 (Docker) or http://localhost:5173 (dev) to see your map.

## Key Features

### 3D Viewer

The 3D viewer supports:
- Multiple 3D models per feature
- Point cloud visualization
- Camera position files
- Interactive tools (wireframe, bounding box, measurements)
- QGIS-style ribbon menu

See [docs/3d-viewer.md](docs/3d-viewer.md) for complete 3D viewer documentation.

### Automatic File Naming

The system automatically prevents file name conflicts by prefixing files with unique feature IDs:
- `model.obj` → `a3f5b2c8_model.obj`
- Multiple features can have files with the same base name
- All references (MTL, textures) automatically updated

See [docs/architecture.md](docs/architecture.md#file-naming-system) for details.

### Supported Formats

**Vector Data:**
- GeoJSON (`.geojson`, `.json`)
- Shapefiles (`.shp` + associated files)

**3D Models:**
- Wavefront OBJ (`.obj` with `.mtl` and textures)
- PLY (`.ply`)

**Point Clouds:**
- LAZ/LAS (`.laz`, `.las`) - converted to COPC
- PLY (`.ply`)
- COPC (`.copc.laz`) - cloud-optimized format

**Raster Data:**
- GeoTIFF (`.tif`, `.tiff`) - converted to COG


## Documentation

- [Docker Setup](docs/docker.md) - Complete Docker usage guide
- [Project Architecture](docs/architecture.md) - Folder structure and file naming
- [Preprocessing](docs/preprocessing.md) - Data optimization pipeline
- [3D Viewer](docs/3d-viewer.md) - 3D visualization features
- [3D Data Configuration](docs/3d-data-config.md) - Linking 3D models to features

## Development

### Development Mode

```bash
# Client (Vue.js with hot-reload)
cd client
npm run dev

# Server (Express with auto-restart)
cd server
npm run dev
```

### Build for Production

```bash
# Client
cd client
npm run build

# Serve via Express
cd server
npm start
```

### Docker Development

```bash
# Start with development profile
docker-compose --profile dev up

# Rebuild after changes
docker-compose up --build
```

## Troubleshooting

### Port Already in Use
Change ports in `docker-compose.yml` or `.env` file.

### 3D Models Not Loading
1. Check that preprocessing completed successfully
2. Verify URLs in processed GeoJSON files
3. Check browser console for errors

### Point Clouds Not Showing
LAZ/LAS files must be preprocessed to COPC format. Run:
```bash
npm run preprocess
```

### Large Files
For files larger than 100MB, preprocessing is recommended:
- 3D models: Decimated to ~1M vertices
- Point clouds: Thinned and converted to COPC
- GeoTIFFs: Converted to COG format

See [docs/preprocessing.md](docs/preprocessing.md) for optimization details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (2D map, 3D viewer, preprocessing)
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenLayers for 2D mapping
- Three.js for 3D visualization
- Vue.js for the frontend framework
- GDAL, PDAL, and MeshLab for data processing tools
