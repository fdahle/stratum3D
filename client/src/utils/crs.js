// client/src/constants/crs.js
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { get as getProjection } from "ol/proj";

// Built-in proj4 definitions for common projections not natively supported by OpenLayers.
// OpenLayers only knows EPSG:3857 and EPSG:4326 out of the box.
const BUILTIN_PROJ_DEFS = {
  'EPSG:3031': '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  'EPSG:3575': '+proj=laea +lat_0=90 +lon_0=10 +x_0=0 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  'EPSG:3995': '+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  'EPSG:27700': '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs',
  'EPSG:2154':  '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
};

export const registerCustomProjections = (config) => {
  const code = config.crs || 'EPSG:3857';
  const params = config.projection_params;

  // Pre-register ALL built-in definitions so OL can reproject data in any of
  // these CRSes (e.g. server-uploaded GeoJSON reprojected to EPSG:3031) even
  // when the map itself uses a different CRS.
  for (const [builtinCode, projStr] of Object.entries(BUILTIN_PROJ_DEFS)) {
    if (!getProjection(builtinCode)) {
      proj4.defs(builtinCode, projStr);
    }
  }

  // Register custom user-specified CRS if not already known
  if (!getProjection(code)) {
    const projString = params?.proj_string || BUILTIN_PROJ_DEFS[code];
    if (!projString) {
      console.warn(`[CRS] No proj4 definition found for "${code}". Add a proj_string under projection_params in your config. Falling back to EPSG:3857.`);
      register(proj4);
      return 'EPSG:3857';
    }
    proj4.defs(code, projString);
  }

  // Sync all registered definitions to OpenLayers in one call
  register(proj4);

  const projection = getProjection(code);
  if (projection && params?.extent) {
    projection.setExtent(params.extent);
  }

  return code;
};

/**
 * Ensure `code` is registered with both proj4 and OpenLayers so that OL can
 * reproject data from that CRS to the map's CRS.  Tries (in order):
 *  1. Already known to OL — no-op.
 *  2. Caller-supplied proj4 string (from server metadata).
 *  3. Built-in proj4 definition table.
 *  4. Live GET from https://epsg.io/{code}.proj4 (requires internet).
 *
 * Returns true when the projection is now available, false if it could not be
 * resolved.  Always resolves — never throws.
 *
 * @param {string} code       EPSG code, e.g. "EPSG:31255"
 * @param {string} [proj4Def] Optional proj4 definition string from the server
 */
export async function tryRegisterProjection(code, proj4Def) {
  if (!code) return false;
  const upper = String(code).trim().toUpperCase();

  // Already known to OpenLayers.
  if (getProjection(upper)) return true;

  // Caller supplied a proj4 string (e.g. from server-side epsg-index lookup).
  if (proj4Def) {
    proj4.defs(upper, proj4Def);
    register(proj4);
    if (getProjection(upper)) return true;
  }

  // Built-in table (no network required).
  if (BUILTIN_PROJ_DEFS[upper]) {
    proj4.defs(upper, BUILTIN_PROJ_DEFS[upper]);
    register(proj4);
    return !!getProjection(upper);
  }

  // Last resort: fetch from epsg.io.
  const epsgNum = upper.startsWith('EPSG:') ? upper.slice(5) : upper;
  try {
    const res = await fetch(`https://epsg.io/${epsgNum}.proj4`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const projStr = (await res.text()).trim();
    // Guard against HTML error pages.
    if (!projStr || projStr.startsWith('<')) return false;
    proj4.defs(upper, projStr);
    register(proj4);
    return !!getProjection(upper);
  } catch {
    return false;
  }
}