const { expo } = require("./app.json");

/**
 * Keep local Android emulator development compatible with an HTTP localhost
 * web server, while never allowing clear-text traffic in an EAS production
 * build. The production profile sets EXPO_PUBLIC_APP_ENV=production.
 */
const isProduction = process.env.EXPO_PUBLIC_APP_ENV === "production";

module.exports = {
  ...expo,
  plugins: expo.plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
      return plugin;
    }

    return [
      plugin[0],
      {
        ...plugin[1],
        android: {
          ...plugin[1].android,
          usesCleartextTraffic: !isProduction,
        },
      },
    ];
  }),
};
