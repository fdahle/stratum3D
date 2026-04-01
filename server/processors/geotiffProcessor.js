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
 * @param {boolean} [options.keepOriginal=false]  Rename original to `original_<filename>` before replacing.
 * @param {string}  [options.compression='lzw']   GDAL compression: lzw | deflate | zstd | none
 * @param {string}  [options.resampling='nearest'] Overview resampling: nearest | bilinear | cubic
 * @param {number}  [options.tileSize=256]         Internal tile size in pixels.
 * @param {string}  [options.nodata]               No-data pixel value (e.g. '0' or '-9999').
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

  const {
    keepOriginal = false,
    compression  = 'lzw',
    resampling   = 'nearest',
    tileSize     = 256,
    nodata,
  } = options;

  const dir      = path.dirname(inputPath);
  const basename = path.basename(inputPath);
  const tmpPath  = path.join(dir, `__cog_tmp_${Date.now()}_${basename}`);

  const compressionUpper = (compression || 'lzw').toUpperCase();
  const args = [
    'gdal_translate',
    '-of COG',
    `-co COMPRESS=${compressionUpper}`,
    `-co RESAMPLING=${(resampling || 'nearest').toUpperCase()}`,
    `-co TILESIZE=${tileSize || 256}`,
    '-co OVERVIEWS=AUTO',
    ...(nodata !== undefined && nodata !== null && nodata !== '' ? [`-a_nodata ${nodata}`] : []),
    `"${inputPath}"`,
    `"${tmpPath}"`,
  ];
  const gdalArgs = args.join(' ');

  let originalBackup = null;
  try {
    await execAsync(gdalArgs);
    // Optionally back up the original
    if (keepOriginal) {
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
