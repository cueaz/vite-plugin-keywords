import {
  collectKeywordsAndGenerateTypes,
  createPrefixedLogger,
  generateModuleCode,
  RESOLVED_VIRTUAL_MODULE_ID,
  resolveOptions,
  splitQuery,
  VIRTUAL_MODULE_ID,
  type KeywordsPluginOptions,
  type PrefixedLogger,
} from 'minifiable-keywords';
import type { Plugin } from 'rollup';
import { PLUGIN_NAME } from './shared';

export type { KeywordsPluginOptions } from 'minifiable-keywords';

export const keywordsPlugin = (options?: KeywordsPluginOptions): Plugin => {
  const pluginOptions = resolveOptions(options);
  let collectedKeywords: Set<string>;
  let logger: PrefixedLogger;
  const root = process.cwd();
  const isDev = pluginOptions.isDev ?? process.env.NODE_ENV === 'development';

  return {
    name: PLUGIN_NAME,
    api: {
      options: pluginOptions,
    },

    async buildStart() {
      const pluginThis = this;
      logger = createPrefixedLogger(
        {
          info: pluginThis.info,
          warn: pluginThis.warn,
          error: pluginThis.error,
        },
        PLUGIN_NAME,
        false,
      );
      collectedKeywords = await collectKeywordsAndGenerateTypes(
        root,
        logger,
        [],
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
        return generateModuleCode(collectedKeywords, isDev);
      }
    },
  };
};

export default keywordsPlugin;
