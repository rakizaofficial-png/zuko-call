import { StatusBar } from "expo-status-bar";
import { Platform, SafeAreaView, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Expo shell — loads the production Luma Next.js user app in a WebView.
 *
 *   cd expo-app && npm install && npx expo start
 */
const LUMA_URL = "https://luma-user.onrender.com";

export default function App() {
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
