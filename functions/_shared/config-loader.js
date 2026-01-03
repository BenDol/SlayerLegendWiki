/**
 * Config Loader for Cloudflare Workers
 *
 * Simple wrapper that imports the JSON config file.
 * This gets bundled by Wrangler and works in Workers environment.
 */

import config from './wiki-config.json';

export default config;
