/**
 * geotiffProcessor.js — Cloud Optimised GeoTIFF (COG) conversion.
 *
 * Requires GDAL's `gdal_translate` to be available on PATH.
 * If GDAL is not installed the conversion is skipped gracefully and the
 * original file is used as-is (still works, just not streaming-optimised).
 */

import { exec }    from 'child_process';
import { promisify } from 'util';
import fs            from 'fs/promises';
import path          from 'path';

const execAsync = promisify(exec);

// ── Tool availability ──────────────────────────────────────────────────────────

let _gdalAvailable = null;

export async function isGdalAvailable() {
  if (_gdalAvailable !== null) return _gdalAvailable;
  try {
    await execAsync('gdal_translate --version');
    _gdalAvailable = true;
  } catch {
    _gdalAvailable = false;
  }
  return _gdalAvailable;
}

// ── COG conversion ─────────────────────────────────────────────────────────────

/**
 * Convert a GeoTIFF to a Cloud Optimised GeoTIFF in-place (or to a temp file
 * then rename) using gdal_translate.
 *
 * @param {string} inputPath    Absolute path to source .tif
 * @param {object} [options]
 * @param {boolean} [options.keepOriginal=false]  If true, rename original to
 *   `original_<filename>` before replacing with the COG.
 * @returns {{ success: boolean, step: string, originalBackup: string|null }}
 */
export async function convertToCog(inputPath, options = {}) {
  if (!(await isGdalAvailable())) {
    return {
      success: false,
      step: 'GDAL not available on this server — GeoTIFF stored as-is (COG conversion skipped)',
      originalBackup: null,
    };
  }

  const dir      = path.dirname(inputPath);
  const basename = path.basename(inputPath);
  const tmpPath  = path.join(dir, `__cog_tmp_${Date.now()}_${basename}`);

  const gdalArgs = [
    'gdal_translate',
    '-of COG',
    '-co COMPRESS=DEFLATE',
    '-co PREDICTOR=2',
    '-co OVERVIEWS=AUTO',
    `"${inputPath}"`,
    `"${tmpPath}"`,
  ].join(' ');

  let originalBackup = null;
  try {
    await execAsync(gdalArgs);
    // Optionally back up the original
    if (options.keepOriginal) {
      originalBackup = `original_${basename}`;
      await fs.rename(inputPath, path.join(dir, originalBackup));
    }
    await fs.rename(tmpPath, inputPath);
    return {
      success: true,
      step: 'Converted to Cloud Optimised GeoTIFF (COG)',
      originalBackup,
    };
  } catch (err) {
    // Clean up temp file if it was created
    await fs.unlink(tmpPath).catch(() => {});
    return {
      success: false,
      step: `COG conversion failed: ${err.message} — original file kept`,
      originalBackup: null,
    };
  }
}
