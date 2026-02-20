import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  collectKeywordsAndGenerateTypes,
  createPrefixedLogger,
} from 'minifiable-keywords';
import { loadConfigFile } from 'rollup/loadConfigFile';
import { PLUGIN_NAME } from './shared';

const main = async () => {
  const root = process.cwd();
  const logger = createPrefixedLogger(console, PLUGIN_NAME);

  const { values } = parseArgs({
    options: {
      config: {
        type: 'string',
        short: 'c',
      },
      configPlugin: {
        type: 'string',
      },
    },
    strict: false,
  });

  const configPath = path.resolve(
    root,
    typeof values.config === 'string' ? values.config : 'rollup.config.js',
  );

  const commandOptions: Record<string, any> = {};
  if (typeof values.configPlugin === 'string') {
    commandOptions.configPlugin = values.configPlugin;
  }

  let pluginOptions;
  let options;
  let warnings;

  try {
    const loaded = await loadConfigFile(configPath, commandOptions);
    options = loaded.options;
    warnings = loaded.warnings;
    warnings.flush();
  } catch (error: any) {
    logger.error(`Error loading Rollup configuration: ${error.message}`);
    process.exit(1);
  }

  for (const option of options) {
    if (!option.plugins) continue;

    const keywordsPlugin = option.plugins.find(
      (plugin: any) => plugin && plugin.name === PLUGIN_NAME,
    );

    if (keywordsPlugin) {
      pluginOptions = (keywordsPlugin as any).api?.options;
      break;
    }
  }

  if (!pluginOptions) {
    logger.error('Keywords plugin not found in Rollup configuration.');
    process.exit(1);
  }

  try {
    await collectKeywordsAndGenerateTypes(root, logger, [], pluginOptions);
  } catch (error: any) {
    logger.error(
      `Failed to collect keywords and generate types: ${error.message}`,
    );
    process.exit(1);
  }
};

await main();
