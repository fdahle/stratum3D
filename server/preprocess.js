import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import * as shapefile from "shapefile";
import * as turf from "@turf/turf";
import { reproject } from "reproject";
import epsg from "epsg-index/all.json" with { type: "json" };
import { parse } from "csv-parse/sync";

// define input/output directories
const INPUT_DIR = path.resolve("../input");
const OUTPUT_DIR = path.resolve("data");

// global config
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

// Helper to apply template strings (e.g. "{id}.jpg" -> "123.jpg")
const applyTemplate = (template, properties) => {
  if (!template) return null;
  let url = template;
  const placeholders = url.match(/{([^}]+)}/g) || [];
  placeholders.forEach((p) => {
    const key = p.replace(/{|}/g, "");
    url = url.replace(p, properties[key] || "");
  });
  return url;
};

const processShapes = async () => {
  const shapeDir = path.join(INPUT_DIR, "shapes");

  const files = fs
    .readdirSync(shapeDir)
    .filter(
      (f) =>
        f.endsWith(".json") || f.endsWith(".geojson") || f.endsWith(".shp"),
    );

  for (const file of files) {
    const filePath = path.join(shapeDir, file);
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
          
          // Handle 3D models - support both single template and array
          if (md.has3DModels) {
            const models = [];
            
            // Support array of templates
            const templates = Array.isArray(md["3DModelTemplate"]) 
              ? md["3DModelTemplate"] 
              : [md["3DModelTemplate"]];
            
            templates.forEach(template => {
              const url = applyTemplate(template, feature.properties);
              if (url && url !== template) {
                models.push(url);
              }
            });
            
            if (models.length > 0) {
              feature.properties._model3dUrls = models;
            }
          }
          
          // Handle point clouds - support both single template and array
          if (md.hasPointClouds) {
            const pointclouds = [];
            
            const templates = Array.isArray(md.pointCloudTemplate) 
              ? md.pointCloudTemplate 
              : [md.pointCloudTemplate];
            
            templates.forEach(template => {
              const url = applyTemplate(template, feature.properties);
              if (url && url !== template) {
                pointclouds.push(url);
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
        } catch (e) { /* keep original on fail */ }

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

      if (geojson.crs) delete geojson.crs;
      geojson.crs = {
        type: "name",
        properties: {
          name: `urn:ogc:def:crs:EPSG::${CONFIG.targetCrs.split(":")[1]}`,
        },
      };

      const orderedGeojson = { crs: geojson.crs, ...geojson };

      const outputName = file.replace(/\.[^/.]+$/, "") + ".geojson";
      fs.writeFileSync(
        path.join(OUTPUT_DIR, outputName),
        JSON.stringify(orderedGeojson),
      );
      console.log(`  Successfully saved: ${outputName}`);
    } else {
      console.warn(`  ! Skipping file due to unsupported format: ${file}`);
    }
  }
};

const loadCsvLookup = (relativeCsvPath, keyColumn, delimiter = ",") => {
  const fullPath = path.resolve(INPUT_DIR, relativeCsvPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ! CSV file not found: ${fullPath}`);
    return null;
  }
  const rawCsv = fs.readFileSync(fullPath, "utf-8");
  const records = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: delimiter,
  });
  const lookup = new Map();
  records.forEach((row) => lookup.set(String(row[keyColumn]), row));
  return lookup;
};

const detectCrs = (geojson) => {
  if (geojson.crs?.properties?.name) {
    const name = geojson.crs.properties.name;
    if (name.includes("CRS84")) return "EPSG:4326";
    const match = name.match(/EPSG::?(\d+)/);
    return match ? `EPSG:${match[1]}` : name;
  }
  return "EPSG:4326";
};

processShapes().catch(console.error);