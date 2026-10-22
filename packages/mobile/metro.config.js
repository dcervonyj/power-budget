const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Expo (SDK 52+) detects the pnpm workspace and sets watchFolders and
// nodeModulesPaths itself, so they are not overridden here.
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Packages that must exist once in the bundle. Workspace packages
// (shared-app) resolve their own copies (React 18 for the web app), so
// Metro is told to take these from the mobile package for every importer.
const SINGLETONS = ['react', 'react-dom', 'react-native', 'mobx', 'mobx-react-lite'];
const projectOrigin = path.join(projectRoot, 'package.json');

const isSingleton = (moduleName) =>
  SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));

// The TypeScript sources use ESM-style relative specifiers (`./App.js` for
// `App.tsx`). Metro does not map them, so a failed `.js` lookup is retried
// without the extension to let Metro pick `.ts` / `.tsx`.
const isRelativeJs = (moduleName) => moduleName.startsWith('.') && moduleName.endsWith('.js');

const resolveWithTsFallback = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (!isRelativeJs(moduleName)) {
      throw error;
    }

    return context.resolveRequest(context, moduleName.slice(0, -'.js'.length), platform);
  }
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isSingleton(moduleName) && context.originModulePath !== projectOrigin) {
    return context.resolveRequest(
      { ...context, originModulePath: projectOrigin },
      moduleName,
      platform,
    );
  }

  return resolveWithTsFallback(context, moduleName, platform);
};

module.exports = config;
