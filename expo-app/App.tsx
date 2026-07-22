import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

/**
 * Fail-safe Expo shell — loads Zuko web app in a WebView.
 * NO native FLAG_SECURE / ScreenCapture (those caused Android force-closes).
 * Full product surface (live video call, coins, gifts, autopush) runs in the
 * deployed web app at EXPO_PUBLIC_LUMA_WEB_URL.
 */
const RAW_APP_URL =
  process.env.EXPO_PUBLIC_LUMA_WEB_URL || "https://luma-user.onrender.com";

/**
 * On the Android emulator, `localhost` / `127.0.0.1` point at the emulator
 * itself, not the developer's machine — so a dev URL like
 * `http://localhost:3000` never reaches the local server and calls/sockets
 * silently fail. `10.0.2.2` is the emulator's special alias for the host
 * machine's loopback, so rewrite to it. (iOS simulators share the host
 * network, so `localhost` already works there.)
 */
function resolveAppUrl(raw: string): string {
  if (Platform.OS === "android") {
    return raw.replace(
      /(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i,
      "$110.0.2.2",
    );
  }
  return raw;
}

const APP_URL = resolveAppUrl(RAW_APP_URL);

const TRANSIENT_HTTP = new Set([502, 503, 504]);
const MAX_AUTO_RETRIES = 4;
const INSTALL_FILE = `${FileSystem.documentDirectory || ""}zuko_install_id.txt`;

async function loadOrCreateInstallId(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(INSTALL_FILE);
    if (info.exists) {
      const id = (await FileSystem.readAsStringAsync(INSTALL_FILE)).trim();
      if (id.length > 8) return id;
    }
  } catch {
    /* create below */
  }
  const id = `android_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await FileSystem.writeAsStringAsync(INSTALL_FILE, id);
  } catch {
    /* ephemeral fallback */
  }
  return id;
}

type BoundaryState = { error: Error | null };

class AppErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.root}>
          <View style={styles.center}>
            <Text style={styles.title}>Zuko hit a snag</Text>
            <Text style={styles.sub}>{this.state.error.message}</Text>
            <Pressable
              style={styles.btn}
              onPress={() => {
                this.setState({ error: null });
                this.props.onReset?.();
              }}
            >
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

/** Ping Render so free-tier cold starts begin before WebView mounts. */
async function wakeApp(url: string, timeoutMs = 90_000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "text/html" },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function ZukoWebShell() {
  const [ready, setReady] = useState(false);
  const [waking, setWaking] = useState(true);
  const [webKey, setWebKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState("");
  const [installId, setInstallId] = useState<string>("");
  const autoRetries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoadDone = useRef(false);

  useEffect(() => {
    void loadOrCreateInstallId().then(setInstallId);
  }, []);

  // Fail-safe first paint, then wake Render before mounting WebView
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setReady(true);
      setWaking(true);
      setRetryHint("Waking Zuko server…");
      firstLoadDone.current = false;
      const ok = await wakeApp(APP_URL);
      if (cancelled) return;
      setWaking(false);
      setRetryHint(ok ? "" : "Server still waking — loading anyway…");
      setWebKey((k) => k + 1);
    };
    void boot();
    return () => {
      cancelled = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const reload = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setLoadError(null);
    setLoading(true);
    setRetryHint("");
    autoRetries.current = 0;
    firstLoadDone.current = false;
    setWebKey((k) => k + 1);
  }, []);

  const scheduleAutoRetry = useCallback((statusCode: number) => {
    if (autoRetries.current >= MAX_AUTO_RETRIES) {
      setLoadError(
        `Server error ${statusCode} — Render may still be starting. Tap Retry.`,
      );
      setLoading(false);
      return;
    }
    autoRetries.current += 1;
    const attempt = autoRetries.current;
    const delay = Math.min(12_000, 2500 * attempt);
    setLoading(true);
    setLoadError(null);
    firstLoadDone.current = false;
    setRetryHint(
      `Server waking (${attempt}/${MAX_AUTO_RETRIES})… retry in ${Math.round(delay / 1000)}s`,
    );
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setWebKey((k) => k + 1);
    }, delay);
  }, []);

  const source = useMemo(() => ({ uri: APP_URL }), []);
  const showOverlay = waking || (loading && !firstLoadDone.current);
  const installBridge = useMemo(() => {
    if (!installId) return undefined;
    const safe = JSON.stringify(installId);
    // Identity + Play Billing bridge stub. When react-native-iap is added,
    // native side should handle ZUKO_IAP_PURCHASE / ZUKO_IAP_RESTORE messages
    // and resolve window.LumaNativeIap promises.
    return `
window.__LUMA_INSTALL_ID__=${safe};
window.__ZUKO_ANDROID__=1;
try{
  localStorage.setItem('luma_install_id_v1',${safe});
  localStorage.setItem('zuko_android_shell_v1','1');
}catch(e){}
window.LumaNativeIap = window.LumaNativeIap || {
  purchase: function(sku){
    return new Promise(function(resolve, reject){
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.__ZUKO_IAP_CB__ = { resolve: resolve, reject: reject, sku: sku };
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZUKO_IAP_PURCHASE', sku: sku }));
          setTimeout(function(){
            if (window.__ZUKO_IAP_CB__) {
              window.__ZUKO_IAP_CB__ = null;
              reject(new Error('Native Play Billing not linked yet — use web checkout'));
            }
          }, 2500);
        } else {
          reject(new Error('Native bridge unavailable'));
        }
      } catch (err) { reject(err); }
    });
  },
  restore: function(){
    return new Promise(function(resolve, reject){
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZUKO_IAP_RESTORE' }));
        }
        resolve({ restored: false });
      } catch (err) { reject(err); }
    });
  }
};
true;`;
  }, [installId]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator color="#2ee6c5" size="large" />
          <Text style={styles.meta}>Starting Zuko…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.frame}>
        {loadError ? (
          <View style={styles.center}>
            <Text style={styles.title}>Couldn’t open Zuko</Text>
            <Text style={styles.sub}>{loadError}</Text>
            <Text style={styles.meta}>{APP_URL}</Text>
            <Pressable style={styles.btn} onPress={reload}>
              <Text style={styles.btnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {!waking ? (
              <WebView
                key={webKey}
                source={source}
                style={styles.webview}
                injectedJavaScriptBeforeContentLoaded={installBridge}
                mediaCapturePermissionGrantType="grant"
                onLoadStart={() => {
                  // Only block UI on cold/first load — SPA navigations must stay interactive
                  if (!firstLoadDone.current) {
                    setLoading(true);
                    setLoadError(null);
                  }
                }}
                onLoadEnd={() => {
                  setLoading(false);
                  setRetryHint("");
                  autoRetries.current = 0;
                  firstLoadDone.current = true;
                }}
                onError={(e) => {
                  setLoading(false);
                  setLoadError(
                    e.nativeEvent?.description || "WebView failed to load",
                  );
                }}
                onHttpError={(e) => {
                  const code = e.nativeEvent.statusCode;
                  if (TRANSIENT_HTTP.has(code)) {
                    scheduleAutoRetry(code);
                    return;
                  }
                  if (code >= 500) {
                    setLoading(false);
                    setLoadError(`Server error ${code}`);
                  }
                }}
                javaScriptEnabled
                domStorageEnabled
                allowFileAccess={false}
                allowUniversalAccessFromFileURLs={false}
                allowFileAccessFromFileURLs={false}
                startInLoadingState={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                setSupportMultipleWindows={false}
                originWhitelist={[
                  "https://luma-user.onrender.com*",
                  "https://*.onrender.com*",
                  "https://*",
                ]}
                mixedContentMode="compatibility"
                androidLayerType="hardware"
                nestedScrollEnabled
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data || "{}") as {
                      type?: string;
                      sku?: string;
                    };
                    if (data.type === "ZUKO_IAP_PURCHASE") {
                      // Placeholder: wire react-native-iap here for production Play Billing.
                      console.log("[zuko] IAP purchase request", data.sku);
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                {...(Platform.OS === "ios"
                  ? ({
                      allowsBackForwardNavigationGestures: true,
                      allowsAirPlayForMediaPlayback: true,
                    } as Record<string, unknown>)
                  : {
                      // Android 11–15: WebView gallery <input type=file>
                      setBuiltInZoomControls: false,
                    })}
              />
            ) : null}
            {showOverlay ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator color="#2ee6c5" size="large" />
                <Text style={styles.meta}>
                  {retryHint || (waking ? "Waking Zuko…" : "Opening Zuko…")}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [shellKey, setShellKey] = useState(0);
  return (
    <AppErrorBoundary onReset={() => setShellKey((k) => k + 1)}>
      <ZukoWebShell key={shellKey} />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0d12" },
  frame: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#0b0d12" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  sub: { color: "#9aa3b2", fontSize: 14, textAlign: "center" },
  meta: { color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 4 },
  btn: {
    marginTop: 10,
    backgroundColor: "#2ee6c5",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: "#0b0d12", fontWeight: "800", fontSize: 15 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,13,18,0.72)",
    gap: 10,
  },
});
