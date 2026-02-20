import path from 'node:path';
import {
  collectKeywordsAndGenerateTypes,
  createPrefixedLogger,
  extractKeywords,
  generateModuleCode,
  generateTypesFile,
  RESOLVED_VIRTUAL_MODULE_ID,
  resolveOptions,
  splitQuery,
  VIRTUAL_MODULE_ID,
  type KeywordsPluginOptions,
  type PrefixedLogger,
} from 'minifiable-keywords';
import type { EnvironmentModuleGraph, Plugin, ResolvedConfig } from 'vite';
import { PLUGIN_NAME } from './shared';

export type { KeywordsPluginOptions } from 'minifiable-keywords';

export const keywordsPlugin = (options?: KeywordsPluginOptions): Plugin => {
  const pluginOptions = resolveOptions(options);
  let collectedKeywords: Set<string>;
  let config: ResolvedConfig;
  let logger: PrefixedLogger;

  const invalidateModule = (
    absoluteId: string,
    moduleGraph: EnvironmentModuleGraph,
  ): void => {
    const module = moduleGraph.getModuleById(absoluteId);
    if (module) {
      moduleGraph.invalidateModule(module);
      module.lastHMRTimestamp = module.lastInvalidationTimestamp || Date.now();
    }
  };

  return {
    name: PLUGIN_NAME,
    api: {
      options: pluginOptions,
    },

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      logger = createPrefixedLogger(config.logger, PLUGIN_NAME);
    },

    async buildStart() {
      collectedKeywords = await collectKeywordsAndGenerateTypes(
        config.root,
        logger,
        [config.build.outDir, config.cacheDir],
        pluginOptions,
      );
    },

    resolveId(source, importer) {
      if (!importer) {
        return;
      }
      const [validSource] = splitQuery(source);
      if (validSource === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      const [validId] = splitQuery(id);
      if (validId === RESOLVED_VIRTUAL_MODULE_ID) {
        const isDev = pluginOptions.isDev ?? config.mode === 'development';
        return generateModuleCode(collectedKeywords, isDev);
      }
    },

    async hotUpdate({ type, file, read }) {
      if (type === 'delete') return;

      const fileExt = path.extname(file);
      if (
        !['.js', '.ts', '.jsx', '.tsx'].includes(fileExt) ||
        file.includes('/.')
      ) {
        return;
      }

      const code = await read();
      const keywordsInFile = extractKeywords(
        code,
        pluginOptions.additionalModulesToScan,
      );
      if (keywordsInFile.size === 0) return;

      const initialSize = collectedKeywords.size;
      for (const key of keywordsInFile) {
        collectedKeywords.add(key);
      }

      const newKeywordsAdded = collectedKeywords.size > initialSize;
      if (newKeywordsAdded) {
        invalidateModule(
          RESOLVED_VIRTUAL_MODULE_ID,
          this.environment.moduleGraph,
        );
        await generateTypesFile(collectedKeywords, config.root);
      }
    },
  };
};

export default keywordsPlugin;
