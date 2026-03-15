const fs = require('fs');
const path = require('path');

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`[metro-fix] Skipped (missing): ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[metro-fix] Patched: ${filePath}`);
  } else {
    console.log(`[metro-fix] No changes needed: ${filePath}`);
  }
}

const root = process.cwd();

patchFile(path.join(root, 'node_modules', '@expo', 'metro-config', 'build', 'file-store.js'), [
  ['metro-cache/src/stores/FileStore', 'metro-cache/private/stores/FileStore'],
]);

patchFile(path.join(root, 'node_modules', '@expo', 'metro-config', 'build', 'ExpoMetroConfig.js'), [
  ['metro/src/DeltaBundler/Graph', 'metro/private/DeltaBundler/Graph'],
]);

patchFile(
  path.join(root, 'node_modules', '@expo', 'metro', 'node_modules', 'metro', 'src', 'DeltaBundler', 'Transformer.js'),
  [[
    'const transformerOptions = {\n      transformerPath: this._config.transformerPath,\n      transformerConfig,\n    };',
    'const resolvedTransformerPath =\n      this._config.transformerPath ?? this._config.transformer?.transformerPath;\n    const transformerOptions = {\n      transformerPath: resolvedTransformerPath,\n      transformerConfig,\n    };',
  ]]
);

patchFile(
  path.join(root, 'node_modules', '@expo', 'metro', 'node_modules', 'metro', 'src', 'DeltaBundler', 'getTransformCacheKey.js'),
  [[
    'const { transformerPath, transformerConfig } = opts.transformerConfig;\n  const Transformer = require.call(null, transformerPath);\n  const transformerKey = Transformer.getCacheKey\n    ? Transformer.getCacheKey(transformerConfig)\n    : "";',
    'const { transformerPath, transformerConfig } = opts.transformerConfig ?? {};\n  const Transformer = transformerPath ? require.call(null, transformerPath) : null;\n  const transformerKey = Transformer?.getCacheKey\n    ? Transformer.getCacheKey(transformerConfig ?? {})\n    : "";\n  const transformerPathCacheKey = transformerPath\n    ? (0, _metroCacheKey.getCacheKey)([require.resolve(transformerPath)])\n    : "";',
  ], [
    '(0, _metroCacheKey.getCacheKey)([require.resolve(transformerPath)]),',
    'transformerPathCacheKey,',
  ], [
    'transformerConfig.globalPrefix,',
    'transformerConfig?.globalPrefix,',
  ]]
);

patchFile(
  path.join(root, 'node_modules', '@expo', 'metro', 'node_modules', 'metro', 'src', 'DeltaBundler', 'Worker.flow.js'),
  [[
    'const Transformer = require.call(null, transformerConfig.transformerPath);',
    'const transformerPath =\n    transformerConfig?.transformerPath ??\n    transformerConfig?.transformer?.transformerPath ??\n    transformerConfig?.transformerConfig?.transformerPath ??\n    require.resolve("@expo/metro-config/build/transform-worker/transform-worker");\n  const Transformer = require.call(null, transformerPath);\n  const resolvedTransformerConfig =\n    transformerConfig?.transformerConfig ?? transformerConfig?.transformer ?? {};',
  ], [
    '    transformerConfig.transformerConfig,',
    '    resolvedTransformerConfig,',
  ]]
);

patchFile(
  path.join(root, 'node_modules', '@expo', 'metro', 'node_modules', 'metro-file-map', 'src', 'cache', 'DiskCacheManager.js'),
  [[
    '      if (e?.code === "ENOENT") {\n        return null;\n      }\n      throw e;',
    '      if (e?.code === "ENOENT") {\n        return null;\n      }\n      if (\n        e?.code === "ERR_BUFFER_TOO_LARGE" ||\n        e?.code === "ERR_INVALID_ARG_TYPE" ||\n        /deserialize|unsupported version|invalid/i.test(String(e?.message || ""))\n      ) {\n        debug("Invalid cache at %s, deleting and rebuilding", this.#cachePath);\n        await _fs.promises.unlink(this.#cachePath).catch(() => {});\n        return null;\n      }\n      throw e;',
  ]]
);

patchFile(
  path.join(root, 'node_modules', 'expo', 'node_modules', '@expo', 'cli', 'build', 'src', 'start', 'server', 'metro', 'withMetroMultiPlatform.js'),
  [[
    '        return [\n            ...polyfills,\n            ...virtualModulesPolyfills,\n            // Removed on server platforms during the transform.\n            require.resolve(\'expo/virtual/streams.js\')\n        ];',
    '        return [\n            ...polyfills,\n            ...virtualModulesPolyfills\n        ];',
  ]]
);

const latestCallbackEsmPatch = [[
  'const useLatestCallback = exports.default;',
  'const useLatestCallback = exports?.default ?? exports;',
]];

patchFile(
  path.join(root, 'node_modules', '@react-navigation', 'core', 'node_modules', 'use-latest-callback', 'esm.mjs'),
  latestCallbackEsmPatch
);

patchFile(
  path.join(root, 'node_modules', 'react-native-tab-view', 'node_modules', 'use-latest-callback', 'esm.mjs'),
  latestCallbackEsmPatch
);
