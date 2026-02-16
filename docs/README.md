# Documentation

Complete documentation for the hist_map project.

## Getting Started

- **[Main README](../README.md)** - Project overview and quick start guide

## Documentation Files

### Setup & Deployment

- **[docker.md](docker.md)** - Docker setup and container management
  - Prerequisites and installation
  - Development and production modes
  - Commands and troubleshooting
  - Environment-specific configurations

### Architecture & Design

- **[architecture.md](architecture.md)** - Project structure and file naming system
  - Folder structure explanation
  - Automatic unique file naming
  - Workflow and best practices
  - GeoTIFF processing

### Data Processing

- **[preprocessing.md](preprocessing.md)** - Data optimization pipeline
  - 3D model decimation
  - Point cloud thinning and COPC conversion
  - CRS reprojection
  - Configuration options and examples

### Features

- **[3d-viewer.md](3d-viewer.md)** - 3D visualization features
  - Ribbon menu interface
  - Supported file formats
  - Camera system
  - Performance optimization
  - Component API reference

- **[3d-data-config.md](3d-data-config.md)** - Linking 3D models to features
  - Configuration format
  - Template syntax
  - Multiple models per feature
  - Examples and best practices

## Configuration Files

The project uses several configuration files:

| File | Purpose | Documentation |
|------|---------|---------------|
| `client/public/config.yaml` | Map display configuration | [architecture.md](architecture.md) |
| `input/input_config.json` | Data source metadata | [3d-data-config.md](3d-data-config.md) |
| `server/preprocess_config.json` | Preprocessing settings | [preprocessing.md](preprocessing.md) |
| `.env` | Environment variables | [docker.md](docker.md) |

## Examples

See the `examples/` folder for example configurations:
- `config_london.yaml` - Example map configuration for London

## Quick Links

### Common Tasks

- **Setting up Docker**: [docker.md](docker.md#quick-start)
- **Adding data**: [architecture.md](architecture.md#workflow)
- **Preprocessing data**: [preprocessing.md](preprocessing.md#usage)
- **Configuring 3D models**: [3d-data-config.md](3d-data-config.md#configuration-format)
- **Understanding file structure**: [architecture.md](architecture.md#folder-structure)

### Troubleshooting

- **Docker issues**: [docker.md](docker.md#troubleshooting)
- **3D model issues**: [preprocessing.md](preprocessing.md#troubleshooting)
- **Performance tips**: [3d-viewer.md](3d-viewer.md#performance-optimization)

## Contributing

When contributing documentation:
1. Keep docs focused and task-oriented
2. Include code examples where helpful
3. Update this index when adding new docs
4. Cross-reference related documentation
