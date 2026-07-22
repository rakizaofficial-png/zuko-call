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
  BackHandler,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  type NativeEventSubscription,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

/**
 * Fail-safe Expo shell — loads Zuko web app in a WebView.
 * Safe areas: react-native-safe-area-context pads TOP/BOTTOM so WebView
 * content never draws under status bar, notch, punch-hole, or nav gestures.
 */
const RAW_APP_URL =
  process.env.EXPO_PUBLIC_LUMA_WEB_URL || "https://luma-user.onrender.com";

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
        <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
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
  const insets = useSafeAreaInsets();
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
  const webRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);

  useEffect(() => {
    void loadOrCreateInstallId().then(setInstallId);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub: NativeEventSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // Prefer in-page router.back via injected handler
        webRef.current?.injectJavaScript(`
(function(){
  try {
    if (typeof window.__ZUKO_ANDROID_BACK__ === 'function') {
      var handled = window.__ZUKO_ANDROID_BACK__();
      if (handled) return true;
    }
  } catch (e) {}
  true;
})();
true;`);
        if (canGoBackRef.current) {
          webRef.current?.goBack();
          return true;
        }
        return false;
      },
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setBackgroundColor("#0b0d12", true);
      RNStatusBar.setBarStyle("light-content", true);
      RNStatusBar.setTranslucent(false);
    }
  }, []);

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

  // Native SafeAreaView already pads the WebView. Inject metrics for diagnostics
  // but keep CSS inset vars at 0 so web headers do not double-pad.
  const installBridge = useMemo(() => {
    const top = Math.max(0, Math.round(insets.top));
    const bottom = Math.max(0, Math.round(insets.bottom));
    const left = Math.max(0, Math.round(insets.left));
    const right = Math.max(0, Math.round(insets.right));
    const safe = JSON.stringify(installId || "");
    return `
(function(){
  var root = document.documentElement;
  root.style.setProperty('--zuko-sat', '0px');
  root.style.setProperty('--zuko-sab', '0px');
  root.style.setProperty('--zuko-sal', '0px');
  root.style.setProperty('--zuko-sar', '0px');
  root.dataset.zukoShellSafe = '1';
  window.__ZUKO_SAFE_AREA__ = { top: ${top}, bottom: ${bottom}, left: ${left}, right: ${right}, shellPadded: true };
  window.__ZUKO_ANDROID__ = 1;
  window.__LUMA_INSTALL_ID__ = ${safe || '""'};
  window.ZukoNativePush = window.ZukoNativePush || {
    getToken: function(){ return Promise.resolve(null); },
    setBadge: function(n){
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZUKO_BADGE', count: n || 0 }));
        }
      } catch (e) {}
    }
  };
  try {
    if (${safe ? "true" : "false"}) {
      localStorage.setItem('luma_install_id_v1', ${safe || '""'});
      localStorage.setItem('zuko_android_shell_v1', '1');
    }
  } catch (e) {}
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
          } else { reject(new Error('Native bridge unavailable')); }
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
})();
true;`;
  }, [installId, insets.top, insets.bottom, insets.left, insets.right]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2ee6c5" size="large" />
        <Text style={styles.meta}>Starting Zuko…</Text>
      </View>
    );
  }

  return (
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
              ref={webRef}
              source={source}
              style={styles.webview}
              injectedJavaScriptBeforeContentLoaded={installBridge}
              mediaCapturePermissionGrantType="grant"
              onNavigationStateChange={(nav: WebViewNavigation) => {
                canGoBackRef.current = Boolean(nav.canGoBack);
              }}
              onLoadStart={() => {
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
                    console.log("[zuko] IAP purchase request", data.sku);
                  }
                  if (data.type === "ZUKO_BACK_AT_ROOT") {
                    BackHandler.exitApp();
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
  );
}

function AppShell({ shellKey }: { shellKey: number }) {
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="light" backgroundColor="#0b0d12" translucent={false} />
      <ZukoWebShell key={shellKey} />
    </SafeAreaView>
  );
}

export default function App() {
  const [shellKey, setShellKey] = useState(0);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppErrorBoundary onReset={() => setShellKey((k) => k + 1)}>
        <AppShell shellKey={shellKey} />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0d12" },
  frame: { flex: 1, backgroundColor: "#0b0d12" },
  webview: { flex: 1, backgroundColor: "#0b0d12" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
    backgroundColor: "#0b0d12",
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
