import path from 'node:path';
import {
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from 'minifiable-keywords';
import type { Plugin, ResolvedConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { keywordsPlugin } from './index';
import { PLUGIN_NAME } from './shared';

const createMockConfig = (root: string): ResolvedConfig =>
  ({
    root,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      clearScreen: vi.fn(),
      hasErrorLogged: vi.fn(),
      hasWarned: false,
    },
    build: {
      outDir: 'dist',
    },
    cacheDir: '.vite',
    mode: 'development',
  }) as unknown as ResolvedConfig;

describe('vite-plugin-keywords', () => {
  it('should have the correct name', () => {
    const plugin = keywordsPlugin();
    expect(plugin.name).toBe(PLUGIN_NAME);
  });

  it('should collect keywords and load the virtual module', async () => {
    const root = path.resolve(__dirname, '..', 'tests', 'fixtures');
    const config = createMockConfig(root);
    const plugin = keywordsPlugin() as Plugin;

    // @ts-expect-error - configResolved is a function
    plugin.configResolved(config);

    const buildStart = plugin.buildStart as Function;
    await buildStart.call(null);

    const resolveId = plugin.resolveId as Function;
    const resolvedId = resolveId.call(
      null,
      VIRTUAL_MODULE_ID,
      'some-importer.ts',
    );
    expect(resolvedId).toBe(RESOLVED_VIRTUAL_MODULE_ID);

    const load = plugin.load as Function;
    const moduleContent = await load.call(null, RESOLVED_VIRTUAL_MODULE_ID);
    expect(moduleContent).toContain('vite_foo');
    expect(moduleContent).toContain('vite_bar');
  });

  it('should collect keywords from additional modules when configured', async () => {
    const root = path.resolve(__dirname, '..', 'tests', 'fixtures');
    const config = createMockConfig(root);
    const plugin = keywordsPlugin({
      additionalModulesToScan: ['react'],
    }) as Plugin;

    // @ts-expect-error - configResolved is a function
    plugin.configResolved(config);

    const buildStart = plugin.buildStart as Function;
    await buildStart.call(null);

    const load = plugin.load as Function;
    const moduleContent = await load.call(null, RESOLVED_VIRTUAL_MODULE_ID);
    expect(moduleContent).toContain('vite_foo');
    expect(moduleContent).toContain('vite_bar');
    expect(moduleContent).toContain('useState');
  });
});
