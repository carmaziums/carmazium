module.exports = function (api) {
  const isTest = api.env('test');
  api.cache.using(() => process.env.BABEL_ENV || 'development');

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: isTest ? 'react' : 'nativewind' }],
    ],
    plugins: isTest ? [] : [
      'nativewind/babel',
      // reanimated/plugin removed: Reanimated v4 uses New Architecture worklets natively
    ],
  };
};
