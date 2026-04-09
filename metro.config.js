const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.unstable_conditionNames = ['require'];

config.resolver.emptyModulePath = require.resolve('metro-runtime/src/modules/empty-module.js', {
	paths: [projectRoot],
});

module.exports = config;
