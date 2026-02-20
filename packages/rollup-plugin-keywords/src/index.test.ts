import path from 'node:path';
import {
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from 'minifiable-keywords';
import type { Plugin, PluginContext } from 'rollup';
import { describe, expect, it, vi } from 'vitest';
import { keywordsPlugin } from './index';
import { PLUGIN_NAME } from './shared';

const createMockPluginContext = (): PluginContext =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    parse: vi.fn(),
    resolve: vi.fn(),
    getModuleInfo: vi.fn(),
    getModuleIds: vi.fn(),
    getWatchFiles: vi.fn(),
    emitFile: vi.fn(),
    setAssetSource: vi.fn(),
    getFileName: vi.fn(),
    load: vi.fn(),
    addWatchFile: vi.fn(),
    cache: {
      has: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
    fs: {},
    environment: {},
  }) as unknown as PluginContext;

describe('rollup-plugin-keywords', () => {
  it('should have the correct name', () => {
    const plugin = keywordsPlugin();
    expect(plugin.name).toBe(PLUGIN_NAME);
  });

  it('should collect keywords and load the virtual module', async () => {
    const originalCwd = process.cwd;
    const root = path.resolve(__dirname, '..', 'tests', 'fixtures');
    process.cwd = () => root;

    const plugin = keywordsPlugin() as Plugin;
    const context = createMockPluginContext();

    const buildStart = plugin.buildStart as Function;
    await buildStart.call(context);

    const resolveId = plugin.resolveId as Function;
    const resolvedId = resolveId.call(
      context,
      VIRTUAL_MODULE_ID,
      'some-importer.ts',
    );
    expect(resolvedId).toBe(RESOLVED_VIRTUAL_MODULE_ID);

    const load = plugin.load as Function;
    const moduleContent = await load.call(context, RESOLVED_VIRTUAL_MODULE_ID);
    expect(moduleContent).toContain('rollup_foo');
    expect(moduleContent).toContain('rollup_bar');

    process.cwd = originalCwd;
  });

  it('should collect keywords from additional modules when configured', async () => {
    const originalCwd = process.cwd;
    const root = path.resolve(__dirname, '..', 'tests', 'fixtures');
    process.cwd = () => root;

    const plugin = keywordsPlugin({
      additionalModulesToScan: ['@/shared/keywords'],
    }) as Plugin;
    const context = createMockPluginContext();

    const buildStart = plugin.buildStart as Function;
    await buildStart.call(context);

    const load = plugin.load as Function;
    const moduleContent = await load.call(context, RESOLVED_VIRTUAL_MODULE_ID);
    expect(moduleContent).toContain('rollup_foo');
    expect(moduleContent).toContain('rollup_bar');
    expect(moduleContent).toContain('customKeyword');

    process.cwd = originalCwd;
  });
});
