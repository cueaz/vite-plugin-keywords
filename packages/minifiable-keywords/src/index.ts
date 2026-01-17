import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse, { type Node } from '@babel/traverse';
import { globby } from 'globby';

export const VIRTUAL_MODULE_ID = 'virtual:keywords';
export const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface PrefixedLogger extends Logger {
  pluginName: string;
}

export const createPrefixedLogger = (
  logger: Logger,
  pluginName: string,
  usePrefix: boolean = true,
): PrefixedLogger => {
  const prefix = usePrefix ? `[${pluginName}] ` : '';
  const prefixed = (message: string) => `${prefix}${message}`;
  return {
    pluginName,
    info: (message: string) => logger.info(prefixed(message)),
    warn: (message: string) => logger.warn(prefixed(message)),
    error: (message: string) => logger.error(prefixed(message)),
  };
};

// ref: https://github.com/babel/babel/discussions/13093
const traverse =
  typeof _traverse === 'function'
    ? _traverse
    : ((_traverse as any).default as typeof _traverse);

export const extractKeywords = (code: string): Set<string> => {
  const keywords = new Set<string>();

  let ast: Node;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch (e) {
    return keywords;
  }

  const keywordNamespaces = new Set<string>();

  traverse(ast, {
    enter(nodePath) {
      const node = nodePath.node;

      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === VIRTUAL_MODULE_ID
      ) {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            keywordNamespaces.add(specifier.local.name);
          }

          if (specifier.type === 'ImportDefaultSpecifier') {
            keywords.add('default');
          }

          if (specifier.type === 'ImportSpecifier') {
            if (specifier.imported.type === 'Identifier') {
              keywords.add(specifier.imported.name);
            }
          }
        }
      }
    },
  });

  if (keywordNamespaces.size === 0) {
    return keywords;
  }

  traverse(ast, {
    enter(nodePath) {
      const node = nodePath.node;

      if (
        node.type === 'MemberExpression' &&
        !node.computed && // Exclude computed properties like K['xyz']
        node.object.type === 'Identifier' &&
        keywordNamespaces.has(node.object.name) &&
        node.property.type === 'Identifier'
      ) {
        keywords.add(node.property.name);
      }

      if (
        node.type === 'TSQualifiedName' &&
        node.left.type === 'Identifier' &&
        keywordNamespaces.has(node.left.name) &&
        node.right.type === 'Identifier'
      ) {
        keywords.add(node.right.name);
      }
    },
  });

  return keywords;
};

const keywordConstPrefix = '_';
const createExportDeclaration = (keywords: Set<string>): string[] => {
  const aliases = [...keywords].map(
    (key) => `  ${keywordConstPrefix}${key} as ${key},`,
  );
  return [`export {`, ...aliases, `};`];
};

export const generateTypesFile = async (
  collectedKeywords: Set<string>,
  root: string,
  dirname: string = '.keywords',
  filename: string = 'index.d.ts',
): Promise<void> => {
  const keywordDeclarations = [...collectedKeywords]
    .map((key) => `declare const ${keywordConstPrefix}${key}: unique symbol;`)
    .join('\n');
  const exportDeclaration =
    createExportDeclaration(collectedKeywords).join('\n');
  const content = `${keywordDeclarations}\n${exportDeclaration}\n`;
  const pluginRoot = path.join(root, dirname);
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(path.join(pluginRoot, filename), `${content.trim()}\n`);
};

export const collectKeywordsFromFiles = async (
  root: string,
  logger: PrefixedLogger,
  ignoredDirs: string[] = [],
): Promise<Set<string>> => {
  const collectedKeywords = new Set<string>();

  logger.info('Scanning project files for keywords...');

  const files = await globby('**/*.{js,ts,jsx,tsx}', {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**', ...ignoredDirs.map((dir) => `${dir}/**`)],
    gitignore: true,
  });

  await Promise.all(
    files.map(async (file) => {
      const code = await readFile(file, 'utf-8');
      const keywords = extractKeywords(code);
      for (const key of keywords) {
        collectedKeywords.add(key);
      }
    }),
  );

  logger.info(
    `Scan complete. Found ${collectedKeywords.size} unique keywords.`,
  );

  return collectedKeywords;
};

export const collectKeywordsAndGenerateTypes = async (
  root: string,
  logger: PrefixedLogger,
  ignoredDirs?: string[],
): Promise<Set<string>> => {
  const collectedKeywords = await collectKeywordsFromFiles(
    root,
    logger,
    ignoredDirs,
  );
  await generateTypesFile(collectedKeywords, root);
  return collectedKeywords;
};

export const generateModuleCode = (
  collectedKeywords: Set<string>,
  isDev: boolean,
): string => {
  const symbolConstructorName = '__SYMBOL__';
  const symbolDeclaration = `const ${symbolConstructorName} = Symbol;`;
  const keywordDeclarations = [...collectedKeywords]
    .map(
      (key) =>
        `const ${keywordConstPrefix}${key} = /* @__PURE__ */ ${symbolConstructorName}(${isDev ? `'${key}'` : ''});`,
    )
    .join('\n');
  const exportDeclaration =
    createExportDeclaration(collectedKeywords).join('\n');
  return `${symbolDeclaration}\n${keywordDeclarations}\n${exportDeclaration}\n`;
};

export const splitQuery = (id: string) => id.split('?');
