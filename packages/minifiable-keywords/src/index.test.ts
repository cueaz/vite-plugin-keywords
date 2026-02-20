import { describe, expect, it } from 'vitest';
import { extractKeywords, generateModuleCode } from './index';

describe('minifiable-keywords', () => {
  describe('extractKeywords', () => {
    it('should extract keywords from namespaced import', () => {
      const code = `
        import * as K from 'virtual:keywords';
        const a = K.foo;
        const b = K.bar;
        type T = K.baz;
      `;
      const keywords = extractKeywords(code);
      expect(keywords).toEqual(new Set(['foo', 'bar', 'baz']));
    });

    it('should return an empty set if no keywords are found', () => {
      const code = `
        const a = 'foo';
        const b = 'bar';
      `;
      const keywords = extractKeywords(code);
      expect(keywords).toEqual(new Set());
    });

    it('should extract keywords from additional modules to scan', () => {
      const code = `
        import * as K from 'virtual:keywords';
        import { customKeyword } from '@/shared/keywords';

        const a = K.foo;
        const b = customKeyword;
      `;
      const keywords = extractKeywords(code, ['@/shared/keywords']);
      expect(keywords).toEqual(new Set(['foo', 'customKeyword']));
    });

    it('should extract keywords from default and named imports', () => {
      const code = `
        import def, { foo, bar as baz } from 'virtual:keywords';
      `;
      const keywords = extractKeywords(code);
      expect(keywords).toEqual(new Set(['default', 'foo', 'bar']));
    });
  });

  describe('generateModuleCode', () => {
    it('should generate module code with keywords', () => {
      const keywords = new Set(['foo', 'bar']);
      const code = generateModuleCode(keywords, true);
      expect(code).toContain('const __SYMBOL__ = Symbol;');
      expect(code).toContain("const _foo = /* @__PURE__ */ __SYMBOL__('foo');");
      expect(code).toContain("const _bar = /* @__PURE__ */ __SYMBOL__('bar');");
      expect(code).toContain('export {\n  _foo as foo,\n  _bar as bar,\n};');
    });

    it('should generate module code without debug info in prod mode', () => {
      const keywords = new Set(['foo', 'bar']);
      const code = generateModuleCode(keywords, false);
      expect(code).toContain('const _foo = /* @__PURE__ */ __SYMBOL__();');
      expect(code).toContain('const _bar = /* @__PURE__ */ __SYMBOL__();');
    });
  });
});
