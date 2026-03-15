// babel.config.js
// Configuración de Babel necesaria para Expo y soporte de módulos modernos
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
