import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import * as shapefile from "shapefile";
import * as turf from "@turf/turf";
import { reproject } from "reproject";
import epsg from "epsg-index/all.json" with { type: "json" };
import {
  copyFile,
  copy3DModelWithDependencies,
  applyTemplate,
  loadCsvLookup,
  detectCrs,
} from "./utils.js";

// Define input/output directories
const INPUT_DIR = path.resolve("../input");
const SHAPES_INPUT_DIR = path.join(INPUT_DIR, "shapes");
const MODELS_INPUT_DIR = path.join(INPUT_DIR, "models");
const POINTCLOUDS_INPUT_DIR = path.join(INPUT_DIR, "pointclouds");

const OUTPUT_DIR = path.resolve("data");
const LAYERS_OUTPUT_DIR = path.join(OUTPUT_DIR, "layers");
const MODELS_OUTPUT_DIR = path.join(OUTPUT_DIR, "3D");
const POINTCLOUDS_OUTPUT_DIR = path.join(OUTPUT_DIR, "pointclouds");

// Global config
const CONFIG = {
  targetCrs: "EPSG:3031",
  simplifyTolerance: 50,
  coordinatePrecision: 0,
};

// Load the mapping config
const MAPPING_PATH = path.join(INPUT_DIR, "input_config.json");
const MAPPING = fs.existsSync(MAPPING_PATH)
  ? JSON.parse(fs.readFileSync(MAPPING_PATH, "utf-8"))
  : {};

// Ensure output directories exist
[LAYERS_OUTPUT_DIR, MODELS_OUTPUT_DIR, POINTCLOUDS_OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const processShapes = async () => {

  // Read all shape files from input directory
  const files = fs
    .readdirSync(SHAPES_INPUT_DIR)
    .filter(
      (f) =>
        f.endsWith(".json") || f.endsWith(".geojson") || f.endsWith(".shp"),
    );

  // Main processing loop for each shape file
  for (const file of files) {
    const filePath = path.join(SHAPES_INPUT_DIR, file);
    const mappingKey = `shapes/${file}`;
    const fileConfig = MAPPING[mappingKey];

    let geojson = null;

    if (file.endsWith(".json") || file.endsWith(".geojson")) {
      console.log(`Processing GeoJSON file: ${file}`);
      geojson = JSON.parse(fs.readFileSync(filePath));
    } else if (file.endsWith(".shp")) {
      console.log(`Processing Shapefile: ${file}`);
      geojson = await shapefile.read(filePath);
    }

    if (geojson) {
      if (geojson.type === "Feature") {
        geojson = { type: "FeatureCollection", features: [geojson] };
      }

      // CRS Detection & Reprojection
      const sourceCrs = detectCrs(geojson);
      if (sourceCrs !== CONFIG.targetCrs) {
        console.log(
          `  - Reprojecting from ${sourceCrs} to ${CONFIG.targetCrs}...`,
        );
        const fromDef = epsg[sourceCrs.split(":")[1]]?.proj4 || sourceCrs;
        const toDef =
          epsg[CONFIG.targetCrs.split(":")[1]]?.proj4 || CONFIG.targetCrs;
        try {
          geojson = reproject(geojson, fromDef, toDef, epsg);
        } catch (err) {
          console.error(`  ! Reprojection failed: ${err.message}`);
        }
      }

      // Attribute Joining
      let csvLookup = null;
      if (fileConfig?.attributes) {
        console.log(
          `  - Joining attributes from ${fileConfig.attributes.attributesFile}...`,
        );
        csvLookup = loadCsvLookup(
          INPUT_DIR,
          fileConfig.attributes.attributesFile,
          fileConfig.attributes.attributesKey,
          fileConfig.attributes.attributesDelimiter,
        );
      }

      // Feature Processing Loop
      geojson.features = geojson.features.map((feature) => {
        if (!feature.properties) feature.properties = {};

        // A. Apply Join
        if (csvLookup && fileConfig.attributes.ownKey) {
          const val = feature.properties[fileConfig.attributes.ownKey];
          const match = csvLookup.get(String(val));
          if (match) {
            feature.properties = { ...feature.properties, ...match };
          }
        }

        // B. Apply URL Templates (Thumbnails, Download, 3D Model)
        if (fileConfig?.metadata) {
          const md = fileConfig.metadata;

          if (md.hasThumbnails) {
            const url = applyTemplate(md.thumbnailTemplate, feature.properties);
            if (url && url !== md.thumbnailTemplate) {
              feature.properties._thumbnailUrl = url;
            }
          }
          
          if (md.hasDownloadLinks) {
            const url = applyTemplate(md.downloadLinkTemplate, feature.properties);
            if (url && url !== md.downloadLinkTemplate) {
              feature.properties._downloadUrl = url;
            }
          }

          // Handle 3D models
          if (md.has3DModels && Array.isArray(md["3DModels"])) {
            const models = [];

            md["3DModels"].forEach((modelDef) => {
              const url = applyTemplate(modelDef.linkTemplate, feature.properties);
              if (url && url !== modelDef.linkTemplate) {
                const filename = path.basename(url);
                const copiedFilename = copy3DModelWithDependencies(
                  filename,
                  MODELS_INPUT_DIR,
                  MODELS_OUTPUT_DIR
                );

                if (copiedFilename) {
                  // Construct the proper URL path relative to the data server
                  const modelUrl = `data/3D/${copiedFilename}`;
                  models.push(modelUrl);
                }
              }
            });

            if (models.length > 0) {
              feature.properties._model3dUrls = models;
            }
          }

          // Handle point clouds
          if (md.hasPointClouds && Array.isArray(md.pointclouds)) {
            const pointclouds = [];

            md.pointclouds.forEach((cloudDef) => {
              const url = applyTemplate(cloudDef.linkTemplate, feature.properties);
              if (url && url !== cloudDef.linkTemplate) {
                const filename = path.basename(url);
                const copiedFilename = copyFile(
                  POINTCLOUDS_INPUT_DIR,
                  filename,
                  POINTCLOUDS_OUTPUT_DIR
                );

                if (copiedFilename) {
                  // Construct the proper URL path relative to the data server
                  const cloudUrl = `data/pointclouds/${copiedFilename}`;
                  pointclouds.push(cloudUrl);
                }
              }
            });

            if (pointclouds.length > 0) {
              feature.properties._pointcloudUrls = pointclouds;
            }
          }
        }

        // C. Simplify
        try {
          feature = turf.simplify(feature, {
            tolerance: CONFIG.simplifyTolerance,
            highQuality: true,
            mutate: false,
          });
        } catch (e) {
          /* keep original on fail */
        }

        feature.properties._featureId = uuidv4();
        return feature;
      });

      // Truncate Coordinates
      geojson = turf.truncate(geojson, {
        precision: CONFIG.coordinatePrecision,
        mutate: true,
      });

      // Set Metadata
      geojson._layerId = uuidv4();
      if (fileConfig?.metadata) geojson._metadata = fileConfig.metadata;

      // Ensure CRS is included and ordered first in the GeoJSON
      if (geojson.crs) delete geojson.crs;
      geojson.crs = {
        type: "name",
        properties: {
          name: `urn:ogc:def:crs:EPSG::${CONFIG.targetCrs.split(":")[1]}`,
        },
      };

      // order to have CRS first (some parsers expect this)
      const orderedGeojson = { crs: geojson.crs, ...geojson };
      
      // Save output
      const outputName = file.replace(/\.[^/.]+$/, "") + ".geojson";
      fs.writeFileSync(
        path.join(LAYERS_OUTPUT_DIR, outputName),
        JSON.stringify(orderedGeojson),
      );
      console.log(`  Successfully saved: ${outputName}`);
    } else {
      console.warn(`  ! Skipping file due to unsupported format: ${file}`);
    }
  }
};

processShapes().catch(console.error);