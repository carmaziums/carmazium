module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Strip console.log/info/debug from production bundles (keeps warn/error,
    // since those are the genuine diagnostic breadcrumbs sprinkled through
    // catch blocks across authStore/ChatContext/etc. — useful for crash
    // reporting and worth keeping in prod builds).
    env: {
      production: {
        plugins: [
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};
