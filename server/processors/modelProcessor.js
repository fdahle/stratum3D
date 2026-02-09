import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Process 3D models with decimation and optimization
 */
export class ModelProcessor {
  constructor(config) {
    this.config = config;
  }

  /**
   * Check if required tools are installed
   */
  async checkDependencies() {
    const tools = {
      meshlab: false,
      blender: false,
      gltfpack: false
    };

    try {
      await execAsync("meshlabserver --version");
      tools.meshlab = true;
    } catch (e) {
      // MeshLab not installed
    }

    try {
      await execAsync("blender --version");
      tools.blender = true;
    } catch (e) {
      // Blender not installed
    }

    try {
      await execAsync("gltfpack --version");
      tools.gltfpack = true;
    } catch (e) {
      // gltfpack not installed
    }

    return tools;
  }

  /**
   * Get file statistics
   */
  getFileStats(filePath) {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    
    // Estimate vertex count from file size (rough approximation)
    // OBJ files: ~50-100 bytes per vertex on average
    const estimatedVertices = Math.floor(stats.size / 75);

    return {
      sizeBytes: stats.size,
      sizeMB: sizeMB.toFixed(2),
      estimatedVertices,
      needsProcessing: sizeMB > this.config.decimation.targetFileSize || 
                       estimatedVertices > this.config.decimation.targetVertices
    };
  }

  /**
   * Decimate model using MeshLab Server
   */
  async decimateWithMeshLab(inputPath, outputPath, targetVertices) {
    const scriptPath = path.join(path.dirname(inputPath), "temp_decimate.mlx");
    
    // Create MeshLab script for decimation
    const mlxScript = `<!DOCTYPE FilterScript>
<FilterScript>
  <filter name="Quadric Edge Collapse Decimation">
    <Param type="RichInt" value="${targetVertices}" name="TargetFaceNum"/>
    <Param type="RichFloat" value="0" name="TargetPerc"/>
    <Param type="RichFloat" value="0.3" name="QualityThr"/>
    <Param type="RichBool" value="${this.config.decimation.preserveNormals}" name="PreserveNormal"/>
    <Param type="RichBool" value="false" name="PreserveTopology"/>
    <Param type="RichBool" value="true" name="OptimalPlacement"/>
    <Param type="RichBool" value="true" name="PlanarQuadric"/>
    <Param type="RichBool" value="false" name="QualityWeight"/>
    <Param type="RichBool" value="true" name="AutoClean"/>
    <Param type="RichBool" value="false" name="Selected"/>
  </filter>
</FilterScript>`;

    fs.writeFileSync(scriptPath, mlxScript);

    try {
      const command = `meshlabserver -i "${inputPath}" -o "${outputPath}" -s "${scriptPath}"`;
      console.log(`  Running: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes("Warning")) {
        console.error(`  MeshLab stderr: ${stderr}`);
      }
      
      // Clean up script
      fs.unlinkSync(scriptPath);
      
      return true;
    } catch (error) {
      console.error(`  MeshLab error: ${error.message}`);
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      return false;
    }
  }

  /**
   * Decimate model using Blender
   */
  async decimateWithBlender(inputPath, outputPath, targetVertices) {
    const scriptPath = path.join(path.dirname(inputPath), "temp_decimate.py");
    
    // Create Blender Python script
    const pyScript = `import bpy
import sys

# Clear default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import OBJ
bpy.ops.import_scene.obj(filepath="${inputPath.replace(/\\/g, '/')}")

# Get imported object
obj = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = obj

# Add decimate modifier
modifier = obj.modifiers.new(name="Decimate", type='DECIMATE')
modifier.decimate_type = 'COLLAPSE'

# Calculate ratio to achieve target vertices
current_verts = len(obj.data.vertices)
target_verts = ${targetVertices}
ratio = min(1.0, target_verts / current_verts)
modifier.ratio = ratio

print(f"Decimating from {current_verts} to ~{int(current_verts * ratio)} vertices (ratio: {ratio})")

# Apply modifier
bpy.ops.object.modifier_apply(modifier="Decimate")

# Export
bpy.ops.export_scene.obj(
    filepath="${outputPath.replace(/\\/g, '/')}",
    use_selection=True,
    use_materials=True,
    use_triangles=False,
    use_normals=${this.config.decimation.preserveNormals ? 'True' : 'False'},
    use_uvs=${this.config.decimation.preserveUVs ? 'True' : 'False'},
    axis_forward='Y',
    axis_up='Z'
)

print(f"Export complete: ${outputPath.replace(/\\/g, '/')}")
`;

    fs.writeFileSync(scriptPath, pyScript);

    try {
      const command = `blender --background --python "${scriptPath}"`;
      console.log(`  Running Blender decimation...`);
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      
      // Clean up script
      fs.unlinkSync(scriptPath);
      
      return true;
    } catch (error) {
      console.error(`  Blender error: ${error.message}`);
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      return false;
    }
  }

  /**
   * Process a single 3D model file
   */
  async processModel(inputPath, outputDir) {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const ext = path.extname(inputPath);
    
    console.log(`\nProcessing 3D model: ${path.basename(inputPath)}`);
    
    // Get file stats
    const stats = this.getFileStats(inputPath);
    console.log(`  - Size: ${stats.sizeMB} MB`);
    console.log(`  - Estimated vertices: ${stats.estimatedVertices.toLocaleString()}`);

    if (!stats.needsProcessing && !this.config.decimation.enabled) {
      console.log(`  - File is small enough, copying as-is...`);
      const outputPath = path.join(outputDir, path.basename(inputPath));
      fs.copyFileSync(inputPath, outputPath);
      return path.basename(inputPath);
    }

    if (!this.config.decimation.enabled) {
      console.log(`  - Decimation disabled, copying as-is...`);
      const outputPath = path.join(outputDir, path.basename(inputPath));
      fs.copyFileSync(inputPath, outputPath);
      return path.basename(inputPath);
    }

    // Check available tools
    const tools = await this.checkDependencies();
    console.log(`  - Available tools: MeshLab=${tools.meshlab}, Blender=${tools.blender}`);

    const targetVertices = this.config.decimation.targetVertices;
    const outputFilename = `${basename}_decimated${ext}`;
    const outputPath = path.join(outputDir, outputFilename);

    // Try decimation with available tools
    let success = false;
    
    if (tools.meshlab) {
      console.log(`  - Attempting decimation with MeshLab (target: ${targetVertices.toLocaleString()} vertices)...`);
      success = await this.decimateWithMeshLab(inputPath, outputPath, targetVertices);
    } else if (tools.blender) {
      console.log(`  - Attempting decimation with Blender (target: ${targetVertices.toLocaleString()} vertices)...`);
      success = await this.decimateWithBlender(inputPath, outputPath, targetVertices);
    } else {
      console.warn(`  ! No decimation tool available (MeshLab or Blender required)`);
      console.log(`  - Copying original file...`);
      fs.copyFileSync(inputPath, path.join(outputDir, path.basename(inputPath)));
      return path.basename(inputPath);
    }

    if (success && fs.existsSync(outputPath)) {
      const newStats = this.getFileStats(outputPath);
      console.log(`  ✓ Decimation complete!`);
      console.log(`    Original: ${stats.sizeMB} MB`);
      console.log(`    Decimated: ${newStats.sizeMB} MB (${((1 - newStats.sizeBytes/stats.sizeBytes) * 100).toFixed(1)}% reduction)`);
      
      // Copy associated files (MTL, textures)
      this.copyAssociatedFiles(inputPath, outputDir, basename, outputFilename);
      
      return outputFilename;
    } else {
      console.error(`  ! Decimation failed, copying original...`);
      fs.copyFileSync(inputPath, path.join(outputDir, path.basename(inputPath)));
      return path.basename(inputPath);
    }
  }

  /**
   * Copy associated files like MTL and textures
   */
  copyAssociatedFiles(inputPath, outputDir, originalBasename, newBasename) {
    const inputDir = path.dirname(inputPath);
    const newBasenameWithoutExt = path.basename(newBasename, path.extname(newBasename));
    
    // Copy MTL file if exists
    const mtlFile = path.join(inputDir, `${originalBasename}.mtl`);
    if (fs.existsSync(mtlFile)) {
      const newMtlPath = path.join(outputDir, `${newBasenameWithoutExt}.mtl`);
      fs.copyFileSync(mtlFile, newMtlPath);
      console.log(`  - Copied material file: ${path.basename(newMtlPath)}`);
    }

    // Copy texture files (common extensions)
    const textureExts = ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'];
    fs.readdirSync(inputDir).forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (textureExts.includes(ext)) {
        const srcPath = path.join(inputDir, file);
        const dstPath = path.join(outputDir, file);
        if (!fs.existsSync(dstPath)) {
          fs.copyFileSync(srcPath, dstPath);
          console.log(`  - Copied texture: ${file}`);
        }
      }
    });
  }
}

/**
 * Batch process all models in input directory
 */
export async function processAllModels(inputDir, outputDir, config) {
  if (!config.models3D.enabled) {
    console.log("3D model processing is disabled in config.");
    return;
  }

  if (!fs.existsSync(inputDir)) {
    console.log(`Input directory does not exist: ${inputDir}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const processor = new ModelProcessor(config.models3D);
  
  // Show installation instructions if tools are missing
  const tools = await processor.checkDependencies();
  if (!tools.meshlab && !tools.blender) {
    console.log("\n⚠️  No 3D processing tools detected!");
    console.log("\nTo enable 3D model decimation, install one of:");
    console.log("\n  MeshLab:");
    console.log("    macOS:   brew install meshlab");
    console.log("    Ubuntu:  sudo apt-get install meshlab");
    console.log("    Windows: Download from https://www.meshlab.net/");
    console.log("\n  OR Blender:");
    console.log("    macOS:   brew install blender");
    console.log("    Ubuntu:  sudo snap install blender --classic");
    console.log("    Windows: Download from https://www.blender.org/");
    console.log("\n  Models will be copied without decimation.\n");
  }

  const files = fs.readdirSync(inputDir).filter(f => 
    f.endsWith('.obj') || f.endsWith('.ply') || f.endsWith('.stl')
  );

  console.log(`\nFound ${files.length} 3D model(s) to process\n`);

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    try {
      await processor.processModel(inputPath, outputDir);
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }

  console.log("\n✓ 3D model processing complete!\n");
}
