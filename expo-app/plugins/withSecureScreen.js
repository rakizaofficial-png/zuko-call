/**
 * Expo config plugin — block screenshots/screen recording + keep screen awake.
 * Sets FLAG_SECURE + FLAG_KEEP_SCREEN_ON on MainActivity.
 */
const {
  withMainActivity,
  createRunOncePlugin,
} = require("@expo/config-plugins");

function withSecureScreen(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("FLAG_SECURE")) return cfg;

    if (!src.includes("import android.view.WindowManager")) {
      src = src.replace(
        /package [\w.]+;/,
        (m) => `${m}\n\nimport android.view.WindowManager;`,
      );
    }

    // Kotlin MainActivity
    if (src.includes("override fun onCreate")) {
      src = src.replace(
        /override fun onCreate\([^\)]*\)\s*\{/,
        (m) => `${m}
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      WindowManager.LayoutParams.FLAG_SECURE or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )`,
      );
    } else if (src.includes("protected void onCreate")) {
      src = src.replace(
        /protected void onCreate\([^\)]*\)\s*\{/,
        (m) => `${m}
    getWindow().setFlags(
      WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    );`,
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withSecureScreen,
  "with-secure-screen",
  "1.0.0",
);
