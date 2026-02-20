import { parseArgs } from 'node:util';
import {
  collectKeywordsAndGenerateTypes,
  createPrefixedLogger,
} from 'minifiable-keywords';
import { resolveConfig } from 'vite';
import { PLUGIN_NAME } from './shared';

const main = async () => {
  const { values } = parseArgs({
    options: {
      config: {
        type: 'string',
        short: 'c',
      },
    },
    strict: false,
  });

  let config;
  try {
    config = await resolveConfig(
      {
        configFile:
          typeof values.config === 'string' ? values.config : undefined,
      },
      'build',
    );
  } catch (error: any) {
    console.error(
      `[${PLUGIN_NAME}] Failed to resolve Vite config: ${error.message}`,
    );
    process.exit(1);
  }

  const logger = createPrefixedLogger(config.logger, PLUGIN_NAME);

  const keywordsPlugin = config.plugins.find(
    (plugin) => plugin.name === PLUGIN_NAME,
  );

  let pluginOptions;
  if (keywordsPlugin) {
    pluginOptions = keywordsPlugin.api?.options;
  } else {
    logger.error('Keywords plugin not found in Vite configuration.');
    process.exit(1);
  }

  try {
    await collectKeywordsAndGenerateTypes(
      config.root,
      logger,
      [config.build.outDir, config.cacheDir],
      pluginOptions,
    );
  } catch (error: any) {
    logger.error(
      `Failed to collect keywords and generate types: ${error.message}`,
    );
    process.exit(1);
  }
};

await main();
