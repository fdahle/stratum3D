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
import { processAllModels } from "./processors/modelProcessor.js";
import { processAllPointClouds } from "./processors/pointcloudProcessor.js";

// Define input/output directories
const INPUT_DIR = path.resolve("../input");
const SHAPES_INPUT_DIR = path.join(INPUT_DIR, "shapes");
const MODELS_INPUT_DIR = path.join(INPUT_DIR, "models");
const POINTCLOUDS_INPUT_DIR = path.join(INPUT_DIR, "pointclouds");
const GEOTIFFS_INPUT_DIR = path.join(INPUT_DIR, "geotiffs");

const OUTPUT_DIR = path.resolve("data");
const LAYERS_OUTPUT_DIR = path.join(OUTPUT_DIR, "shapes");
const MODELS_OUTPUT_DIR = path.join(OUTPUT_DIR, "3D");
const POINTCLOUDS_OUTPUT_DIR = path.join(OUTPUT_DIR, "pointclouds");
const GEOTIFFS_OUTPUT_DIR = path.join(OUTPUT_DIR, "geotiffs");

// Load preprocessing config
const PREPROCESS_CONFIG_PATH = path.resolve("preprocess_config.json");
const PREPROCESS_CONFIG = fs.existsSync(PREPROCESS_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(PREPROCESS_CONFIG_PATH, "utf-8"))
  : {
      shapes: {
        targetCrs: "EPSG:3031",
        simplifyTolerance: 50,
        coordinatePrecision: 0,
      },
      models3D: {
        enabled: true,
        decimation: {
          enabled: true,
          targetVertices: 1000000,
          targetFileSize: 100,
        },
      },
    };

// Legacy config for backward compatibility
const CONFIG = PREPROCESS_CONFIG.shapes;

// Load the mapping config
const MAPPING_PATH = path.join(INPUT_DIR, "input_config.json");
const MAPPING = fs.existsSync(MAPPING_PATH)
  ? JSON.parse(fs.readFileSync(MAPPING_PATH, "utf-8"))
  : {};

// Ensure output directories exist
[LAYERS_OUTPUT_DIR, MODELS_OUTPUT_DIR, POINTCLOUDS_OUTPUT_DIR, GEOTIFFS_OUTPUT_DIR].forEach((dir) => {
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
        
        // Generate unique feature ID (used for file naming and client-side identification)
        const featureId = uuidv4();
        feature.properties._featureId = featureId;

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
                
                // Pass featureId to ensure unique filenames
                const copiedFilename = copy3DModelWithDependencies(
                  filename,
                  MODELS_INPUT_DIR,
                  MODELS_OUTPUT_DIR,
                  featureId  // Add feature ID for unique naming
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
                
                // Pass featureId to ensure unique filenames
                const copiedFilename = copyFile(
                  POINTCLOUDS_INPUT_DIR,
                  filename,
                  POINTCLOUDS_OUTPUT_DIR,
                  featureId  // Add feature ID for unique naming
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
          });
        } catch (e) {
          /* keep original on fail */
        }

        // Restore feature ID (turf.simplify may drop custom properties)
        feature.properties._featureId = featureId;
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

const processModels = async () => {
  console.log("\n=== Processing 3D Models ===\n");
  await processAllModels(MODELS_INPUT_DIR, MODELS_OUTPUT_DIR, PREPROCESS_CONFIG);
};

const processPointClouds = async () => {
  console.log("\n=== Processing Point Clouds ===\n");
  await processAllPointClouds(POINTCLOUDS_INPUT_DIR, POINTCLOUDS_OUTPUT_DIR, PREPROCESS_CONFIG);
};

const processGeoTIFFs = async () => {
  console.log("\n=== Processing GeoTIFFs ===\n");
  
  if (!PREPROCESS_CONFIG.geotiffs?.enabled) {
    console.log("  GeoTIFF processing is disabled in config. Skipping...");
    return;
  }

  if (!fs.existsSync(GEOTIFFS_INPUT_DIR)) {
    console.log("  No geotiffs/ folder found in input. Skipping...");
    return;
  }

  const files = fs
    .readdirSync(GEOTIFFS_INPUT_DIR)
    .filter((f) => /\.tiff?$/i.test(f));

  console.log(`  Found ${files.length} GeoTIFF(s) to process`);

  for (const file of files) {
    const inputPath = path.join(GEOTIFFS_INPUT_DIR, file);
    const outputName = file.replace(/\.tiff?$/, ".tif");
    const outputPath = path.join(GEOTIFFS_OUTPUT_DIR, outputName);

    console.log(`\n  Processing: ${file}`);

    const config = PREPROCESS_CONFIG.geotiffs;

    // Check if GDAL is available
    const { execSync } = await import("child_process");
    let gdalAvailable = false;
    try {
      execSync("gdalinfo --version", { stdio: "ignore" });
      gdalAvailable = true;
    } catch (e) {
      gdalAvailable = false;
    }

    if (!gdalAvailable) {
      console.log("  ⚠ GDAL not found. Installing GDAL is recommended for optimization.");
      console.log("    macOS: brew install gdal");
      console.log("    Ubuntu: sudo apt-get install gdal-bin");
      console.log("    Windows: https://gdal.org/download.html");
      console.log("  → Copying file as-is...");
      fs.copyFileSync(inputPath, outputPath);
      console.log(`  ✔ Copied: ${outputName}`);
      continue;
    }

    // Build GDAL command for optimization
    const args = [];

    // Check if already Cloud Optimized
    let isCOG = false;
    try {
      const info = execSync(`gdalinfo "${inputPath}"`, { encoding: "utf-8" });
      if (info.includes("LAYOUT=COG")) {
        isCOG = true;
        console.log("  → Already Cloud Optimized (COG)");
      }
    } catch (e) {
      console.error("  ! Failed to read GeoTIFF info");
    }

    // If optimization is disabled or already COG, just copy
    if (!config.optimization?.enabled || (isCOG && !config.targetCrs)) {
      fs.copyFileSync(inputPath, outputPath);
      console.log(`  ✔ Copied: ${outputName}`);
      continue;
    }

    // Convert to COG with optimization
    console.log("  → Optimizing GeoTIFF...");

    try {
      // Base command
      let cmd = `gdalwarp "${inputPath}" "${outputPath}"`;

      // Add CRS reprojection if specified
      if (config.targetCrs) {
        const targetEpsg = config.targetCrs.replace("EPSG:", "");
        cmd += ` -t_srs EPSG:${targetEpsg}`;
        console.log(`    - Reprojecting to ${config.targetCrs}`);
      }

      // Add resampling method
      if (config.resampling?.method) {
        cmd += ` -r ${config.resampling.method}`;
      }

      // Add resolution if specified
      if (config.resampling?.resolution) {
        cmd += ` -tr ${config.resampling.resolution} ${config.resampling.resolution}`;
      }

      // Cloud Optimize
      if (config.optimization?.createCOG) {
        cmd += ` -co TILED=YES`;
        cmd += ` -co COPY_SRC_OVERVIEWS=YES`;
        cmd += ` -co COMPRESS=${config.optimization.compression || "DEFLATE"}`;
        console.log(`    - Creating Cloud Optimized GeoTIFF (COG)`);
      }

      // Add overviews
      if (config.optimization?.overviews) {
        cmd += ` -co OVERVIEW_RESAMPLING=BILINEAR`;
        console.log(`    - Adding internal overviews`);
      }

      execSync(cmd, { stdio: "inherit" });
      console.log(`  ✔ Optimized: ${outputName}`);
    } catch (error) {
      console.error(`  ✗ Failed to process ${file}:`, error.message);
      // Fallback: copy original file
      try {
        fs.copyFileSync(inputPath, outputPath);
        console.log(`  ✔ Copied original file as fallback`);
      } catch (copyError) {
        console.error(`  ✗ Failed to copy file:`, copyError.message);
      }
    }
  }
};

const main = async () => {
  console.log("\n========================================");
  console.log("   PREPROCESSING PIPELINE");
  console.log("========================================\n");
  
  console.log("Configuration:");
  console.log(`  - Shapes CRS: ${CONFIG.targetCrs}`);
  console.log(`  - 3D Models: ${PREPROCESS_CONFIG.models3D.enabled ? 'Enabled' : 'Disabled'}`);
  if (PREPROCESS_CONFIG.models3D.enabled && PREPROCESS_CONFIG.models3D.decimation.enabled) {
    console.log(`  - Decimation: Target ${PREPROCESS_CONFIG.models3D.decimation.targetVertices.toLocaleString()} vertices`);
  }
  console.log(`  - Point Clouds: ${PREPROCESS_CONFIG.pointclouds.enabled ? 'Enabled' : 'Disabled'}`);
  if (PREPROCESS_CONFIG.pointclouds.enabled && PREPROCESS_CONFIG.pointclouds.thinning.enabled) {
    console.log(`  - Thinning: Max ${PREPROCESS_CONFIG.pointclouds.thinning.maxPoints.toLocaleString()} points`);
  }
  console.log(`  - GeoTIFFs: ${PREPROCESS_CONFIG.geotiffs?.enabled ? 'Enabled' : 'Disabled'}`);
  if (PREPROCESS_CONFIG.geotiffs?.enabled && PREPROCESS_CONFIG.geotiffs?.optimization?.createCOG) {
    console.log(`  - COG Optimization: Enabled`);
  }
  console.log("\n");
  
  // Process shapes
  console.log("=== Processing Shapes ===\n");
  await processShapes();
  
  // Process 3D models
  await processModels();
  
  // Process point clouds
  await processPointClouds();
  
  // Process GeoTIFFs
  await processGeoTIFFs();
  
  console.log("\n========================================");
  console.log("   PREPROCESSING COMPLETE");
  console.log("========================================\n");
};

main().catch(console.error);