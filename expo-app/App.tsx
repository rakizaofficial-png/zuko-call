import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, SafeAreaView, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import * as ScreenCapture from "expo-screen-capture";

/**
 * Expo shell — loads the production Luma Next.js user app in a WebView.
 * Anti-screenshot / anti-recording via FLAG_SECURE (Android) + screen capture
 * prevention APIs. Web browsers cannot enforce this — native build required.
 *
 *   cd expo-app && npm install && npx expo start
 *   eas build --platform android --profile production
 */
const LUMA_URL =
  process.env.EXPO_PUBLIC_LUMA_WEB_URL || "https://luma-user.onrender.com";

export default function App() {
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch {
        /* Expo Go / web may not support FlagSecure */
      }
    })();
    return () => {
      if (!active) return;
      active = false;
      void ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.frame}>
        <WebView
          source={{ uri: LUMA_URL }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsBackForwardNavigationGestures
          mediaCapturePermissionGrantType="grant"
          {...(Platform.OS === "ios"
            ? { allowsAirPlayForMediaPlayback: true }
            : {})}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0d12" },
  frame: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#0b0d12" },
});
