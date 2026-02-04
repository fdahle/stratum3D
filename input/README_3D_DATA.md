# 3D Data Configuration

## Overview

The system supports multiple 3D models and point clouds per feature. Only features that have valid 3D data will show the "View in 3D" button.

## Configuration Format

### Single Template (backward compatible)

```json
{
  "shapes/myfile.geojson": {
    "metadata": {
      "has3DModels": true,
      "3DModelTemplate": "https://example.com/models/{feature_id}.obj",
      "hasPointClouds": true,
      "pointCloudTemplate": "https://example.com/pointclouds/{feature_id}.copc.laz"
    }
  }
}
```

### Multiple Templates (Array Format)

```json
{
  "shapes/myfile.geojson": {
    "metadata": {
      "has3DModels": true,
      "3DModelTemplate": [
        "https://example.com/models/{feature_id}_model1.obj",
        "https://example.com/models/{feature_id}_model2.obj",
        "/local/models/{feature_id}_detail.obj"
      ],
      "hasPointClouds": true,
      "pointCloudTemplate": [
        "https://example.com/pc/{feature_id}_scan1.copc.laz",
        "https://example.com/pc/{feature_id}_scan2.copc.laz"
      ]
    }
  }
}
```

## How It Works

### 1. Template Processing (server/preprocess.js)

When processing features, the system:

- Takes each template string (or array of templates)
- Replaces `{placeholder}` with the feature's property value
- Only adds the URL if:
  - The placeholder exists in the feature properties
  - The resulting URL is different from the template (not empty)

### 2. Feature Properties (output)

For each feature that has 3D data, the preprocessor adds:

```javascript
{
  properties: {
    // ... other properties
    _model3dUrls: [
      "https://example.com/models/ABC123_model1.obj",
      "https://example.com/models/ABC123_model2.obj"
    ],
    _pointcloudUrls: [
      "https://example.com/pc/ABC123_scan1.copc.laz"
    ]
  }
}
```

Features without valid 3D data will **not** have these properties.

### 3. Frontend Display (client)

The AttributePanel component:

- Checks if `_model3dUrls` or `_pointcloudUrls` arrays exist and have length > 0
- Only shows "View in 3D" button for features with 3D data
- Passes all URLs as comma-separated query params when opening 3D viewer

### 4. 3D Viewer (client/views/3DView.vue)

The 3D viewer:

- Parses comma-separated `models` and `pointclouds` query params
- Loads each model sequentially
- Positions multiple models side-by-side (120 units apart)
- Allows file upload for additional models

## Examples

### Example 1: Photos with Optional 3D Models

Some aerial photos have 3D reconstructions, some don't:

```json
{
  "shapes/photos.geojson": {
    "metadata": {
      "has3DModels": true,
      "3DModelTemplate": "https://3d.site.com/{photo_id}.obj"
    }
  }
}
```

Features:
- Photo ABC123: Has property `photo_id: "ABC123"` → URL becomes `https://3d.site.com/ABC123.obj` → Button shows
- Photo XYZ456: Has property `photo_id: ""` → Template can't be replaced → No button
- Photo DEF789: Missing `photo_id` property → Template can't be replaced → No button

### Example 2: Stations with Multiple Scans

Each station has multiple point cloud scans:

```json
{
  "shapes/stations.geojson": {
    "metadata": {
      "hasPointClouds": true,
      "pointCloudTemplate": [
        "https://scans.site.com/{station_id}_scan1.copc.laz",
        "https://scans.site.com/{station_id}_scan2.copc.laz",
        "https://scans.site.com/{station_id}_scan3.copc.laz"
      ]
    }
  }
}
```

Result for station with `station_id: "STAT001"`:
```javascript
_pointcloudUrls: [
  "https://scans.site.com/STAT001_scan1.copc.laz",
  "https://scans.site.com/STAT001_scan2.copc.laz",
  "https://scans.site.com/STAT001_scan3.copc.laz"
]
```

### Example 3: Mixed Local and Remote Models

```json
{
  "shapes/buildings.geojson": {
    "metadata": {
      "has3DModels": true,
      "3DModelTemplate": [
        "/models/local/{building_id}_facade.obj",
        "https://remote.site.com/models/{building_id}_interior.obj"
      ]
    }
  }
}
```

## Template Placeholders

Placeholders in templates are replaced with feature property values:

- `{feature_id}` → replaced with `feature.properties.feature_id`
- `{name}` → replaced with `feature.properties.name`
- `{tma_number}` → replaced with `feature.properties.tma_number`

If a property doesn't exist or is empty, the template is skipped for that feature.

## Backward Compatibility

The system supports both formats:

- Old format: `_model3dUrl` (single string)
- New format: `_model3dUrls` (array)

The frontend automatically converts old format to array format for consistency.
