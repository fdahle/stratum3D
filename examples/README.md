# Example Configurations

This folder contains example configuration files you can use as templates for your own projects.

## Map Configurations

### config_london.yaml

A simple example map configuration for London using standard web projections (EPSG:3857).

**Features:**
- Multiple base layers (OSM, Satellite, CartoDB, OpenTopoMap)
- Standard Web Mercator projection
- Simple overlay layer configuration

**Use this as a template for:**
- Standard web maps
- City/regional maps
- Projects using common CRS (EPSG:3857 or EPSG:4326)

**To use:**
```bash
# Copy to your client public folder
cp examples/config_london.yaml client/public/config.yaml

# Edit to match your data
# Update layer URLs, center coordinates, etc.
```

## Active Configuration

The active map configuration is located at:
```
client/public/config.yaml
```

This is the configuration file that the application actually uses. The files in this `examples/` folder are just templates and are not loaded by the application.

## Creating Your Own Configuration

1. Copy an example that matches your needs
2. Update the CRS and projection parameters
3. Configure base layers (tile servers, WMS, etc.)
4. Add your overlay layers (GeoJSON, GeoTIFF, etc.)
5. Set appropriate zoom levels and bounds
6. Save as `client/public/config.yaml`

See [docs/architecture.md](../docs/architecture.md) for detailed configuration documentation.

## Configuration Schema

For information about configuration validation and available options, see:
- `client/src/constants/configSchema.js` - Configuration schema definition
- `client/src/constants/configValidation.js` - Validation logic

## Common CRS Examples

### Web Mercator (EPSG:3857)
Standard web mapping projection - used by Google Maps, OpenStreetMap
```yaml
crs: "EPSG3857"
```

### WGS84 Geographic (EPSG:4326)
Latitude/longitude coordinates
```yaml
crs: "EPSG4326"
```

### Antarctic Polar Stereographic (EPSG:3031)
Example from main config - for Antarctic data
```yaml
crs: "EPSG:3031"
projection_params:
  proj_string: "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
  extent: [-12367396.2185, -12367396.2185, 12367396.2185, 12367396.2185]
```

## Need Help?

- See [docs/README.md](../docs/README.md) for complete documentation
- Check the main [README.md](../README.md) for quick start guide
