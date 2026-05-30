module.exports = function (api) {
  const isTest = api.env('test');
  api.cache.using(() => process.env.BABEL_ENV || 'development');

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: isTest ? 'react' : 'nativewind',
          // Reanimated v4 + New Architecture handles worklets natively — no Babel plugin needed.
          // Disabling stops babel-preset-expo from auto-loading react-native-reanimated/plugin
          // which pulls in react-native-worklets/plugin and breaks Metro's transform worker.
          reanimated: false,
        },
      ],
      // nativewind/babel must be a preset (not a plugin) in NativeWind v4
      ...(isTest ? [] : ['nativewind/babel']),
    ],
  };
};
