import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
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
  PermissionsAndroid,
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
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  fetchProducts,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from "react-native-iap";

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
const IAP_PRODUCT_IDS = [
  "zuko_coins_90",
  "zuko_coins_600",
  "zuko_coins_1300",
];
const IAP_SUBSCRIPTION_IDS = ["luma_vip_week", "luma_vip_month", "luma_vip_year"];

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
  const iapReadyRef = useRef(false);
  const availableIapProductsRef = useRef<Set<string>>(new Set());
  const pendingPurchasesRef = useRef<Map<string, Purchase>>(new Map());

  const injectIapResult = useCallback(
    (
      callbackName: "__ZUKO_IAP_CB__" | "__ZUKO_IAP_RESTORE_CB__" | "__ZUKO_IAP_PRODUCTS_CB__",
      method: "resolve" | "reject",
      value: unknown,
    ) => {
      webRef.current?.injectJavaScript(`
(function(){
  try {
    var callbackName = ${JSON.stringify(callbackName)};
    var callback = window[callbackName];
    if (callback && callback.${method}) callback.${method}(${JSON.stringify(value)});
    window[callbackName] = null;
  } catch (e) {}
  true;
})();
true;`);
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;

    let cancelled = false;
    let purchaseSub: { remove: () => void } | undefined;
    let errorSub: { remove: () => void } | undefined;

    const connect = async () => {
      try {
        await initConnection();
        if (cancelled) return;

        purchaseSub = purchaseUpdatedListener((purchase) => {
          const purchaseToken = purchase.purchaseToken;
          if (!purchaseToken) {
            injectIapResult(
              "__ZUKO_IAP_CB__",
              "reject",
              "Google Play did not return a purchase token.",
            );
            return;
          }
          pendingPurchasesRef.current.set(purchaseToken, purchase);
          injectIapResult("__ZUKO_IAP_CB__", "resolve", {
            platform: "google",
            productId: purchase.productId,
            purchaseToken,
            transactionId: purchase.transactionId,
          });
        });

        errorSub = purchaseErrorListener((error) => {
          injectIapResult(
            "__ZUKO_IAP_CB__",
            "reject",
            error.message || "Google Play purchase failed.",
          );
        });

        const products = (await fetchProducts({ skus: IAP_PRODUCT_IDS, type: "in-app" })) || [];
        availableIapProductsRef.current = new Set(
          products.map((product) => product.id),
        );
        iapReadyRef.current = true;
      } catch (error) {
        iapReadyRef.current = false;
        console.warn("Google Play Billing connection failed", error);
      }
    };

    void connect();
    return () => {
      cancelled = true;
      iapReadyRef.current = false;
      availableIapProductsRef.current.clear();
      purchaseSub?.remove();
      errorSub?.remove();
      void endConnection();
    };
  }, [injectIapResult]);

  const handleIapMessage = useCallback(
    async (data: {
      type?: string;
      sku?: string;
      purchaseToken?: string;
      productType?: string;
    }) => {
      try {
        if (data.type === "ZUKO_IAP_PRODUCTS") {
          const products = (await fetchProducts({ skus: [...IAP_PRODUCT_IDS, ...IAP_SUBSCRIPTION_IDS], type: "all" })) || [];
          injectIapResult("__ZUKO_IAP_PRODUCTS_CB__", "resolve", products.map((product) => ({
            productId: product.id,
            displayPrice: product.displayPrice,
          })));
          return;
        }
        if (!iapReadyRef.current) {
          throw new Error(
            "Google Play Billing is not ready. Close and reopen the app, then try again.",
          );
        }

        if (data.type === "ZUKO_IAP_PURCHASE") {
          const productId = String(data.sku || "").trim();
          const isSubscription = data.productType === "subs" || IAP_SUBSCRIPTION_IDS.includes(productId);
          if (![...IAP_PRODUCT_IDS, ...IAP_SUBSCRIPTION_IDS].includes(productId)) {
            throw new Error(`Unknown Google Play product: ${productId}`);
          }

          // Refresh this SKU immediately before checkout. This prevents a stale
          // startup query from turning a valid Play product into an opaque
          // "unknown product" failure.
          const products = (await fetchProducts({ skus: [productId], type: isSubscription ? "subs" : "in-app" })) || [];
          for (const product of products) {
            availableIapProductsRef.current.add(product.id);
          }
          if (!availableIapProductsRef.current.has(productId)) {
            throw new Error(
              `Google Play product ${productId} is unavailable. Install Zuko from the Play internal test track, sign in with an approved tester account, and make sure this product is active in Play Console.`,
            );
          }
          if (isSubscription) {
            const subscription = products.find((item) => item.id === productId && item.type === "subs");
            const offerToken = subscription?.type === "subs" && subscription.platform === "android"
              ? subscription.subscriptionOffers.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid
              : undefined;
            if (!offerToken) throw new Error("No eligible Google Play subscription offer is available.");
            await requestPurchase({ request: { google: { skus: [productId], subscriptionOffers: [{ sku: productId, offerToken }] } }, type: "subs" });
          } else {
            await requestPurchase({ request: { google: { skus: [productId] } }, type: "in-app" });
          }
          return;
        }

        if (data.type === "ZUKO_IAP_RESTORE") {
          const purchases = await getAvailablePurchases();
          const restorable = purchases
            .filter((purchase) => Boolean(purchase.purchaseToken))
            .map((purchase) => {
              pendingPurchasesRef.current.set(
                purchase.purchaseToken!,
                purchase,
              );
              return {
                platform: "google",
                productId: purchase.productId,
                purchaseToken: purchase.purchaseToken!,
                transactionId: purchase.transactionId,
              };
            });
          injectIapResult(
            "__ZUKO_IAP_RESTORE_CB__",
            "resolve",
            restorable,
          );
          return;
        }

        if (data.type === "ZUKO_IAP_FINISH") {
          const purchaseToken = String(data.purchaseToken || "");
          let purchase = pendingPurchasesRef.current.get(purchaseToken);
          if (!purchase) {
            const purchases = await getAvailablePurchases();
            purchase = purchases.find(
              (item) => item.purchaseToken === purchaseToken,
            );
          }
          if (!purchase) {
            throw new Error("Verified purchase was not found on this device.");
          }
          await finishTransaction({ purchase, isConsumable: !IAP_SUBSCRIPTION_IDS.includes(purchase.productId) });
          pendingPurchasesRef.current.delete(purchaseToken);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Google Play Billing failed.";
        injectIapResult(
          data.type === "ZUKO_IAP_RESTORE"
            ? "__ZUKO_IAP_RESTORE_CB__"
            : "__ZUKO_IAP_CB__",
          "reject",
          message,
        );
      }
    },
    [injectIapResult],
  );

  useEffect(() => {
    void loadOrCreateInstallId().then(setInstallId);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub: NativeEventSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // Ask the web app to handle back; wait for ZUKO_BACK_RESULT via onMessage.
        // Do NOT also call goBack() synchronously — that double-navigates.
        webRef.current?.injectJavaScript(`
(function(){
  try {
    var handled = false;
    if (typeof window.__ZUKO_ANDROID_BACK__ === 'function') {
      handled = !!window.__ZUKO_ANDROID_BACK__();
    }
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ZUKO_BACK_RESULT',
        handled: handled
      }));
    }
  } catch (e) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ZUKO_BACK_RESULT',
          handled: false
        }));
      }
    } catch (e2) {}
  }
  true;
})();
true;`);
        // Consume the event while the web layer responds; root exit comes via
        // ZUKO_BACK_AT_ROOT / ZUKO_BACK_RESULT handled=false + no history.
        return true;
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
  var nativeIap = window.ZukoNativeIap || window.LumaNativeIap || {
    isNativeGooglePlay: true,
    purchase: function(sku, productType){
      return new Promise(function(resolve, reject){
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.__ZUKO_IAP_CB__ = { resolve: resolve, reject: reject, sku: sku };
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZUKO_IAP_PURCHASE', sku: sku, productType: productType || 'in-app' }));
          } else { reject(new Error('Native bridge unavailable')); }
        } catch (err) { reject(err); }
      });
    },
    restore: function(){
      return new Promise(function(resolve, reject){
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.__ZUKO_IAP_RESTORE_CB__ = { resolve: resolve, reject: reject };
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZUKO_IAP_RESTORE' }));
          } else { reject(new Error('Native bridge unavailable')); }
        } catch (err) { reject(err); }
      });
    },
    products: function(){
      return new Promise(function(resolve, reject){
        try {
          window.__ZUKO_IAP_PRODUCTS_CB__ = { resolve: resolve, reject: reject };
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZUKO_IAP_PRODUCTS' }));
        } catch (err) { reject(err); }
      });
    },
    finish: function(purchaseToken){
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ZUKO_IAP_FINISH',
            purchaseToken: purchaseToken
          }));
        }
      } catch (e) {}
      return Promise.resolve();
    }
  };
  window.ZukoNativeIap = nativeIap;
  window.LumaNativeIap = nativeIap;
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
              mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
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
              ]}
              mixedContentMode="compatibility"
              androidLayerType="hardware"
              nestedScrollEnabled
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data || "{}") as {
                    type?: string;
                    sku?: string;
                    purchaseToken?: string;
                    requestId?: string;
                    handled?: boolean;
                    count?: number;
                  };
                  if (
                    data.type === "ZUKO_IAP_PURCHASE" ||
                    data.type === "ZUKO_IAP_PRODUCTS" ||
                    data.type === "ZUKO_IAP_RESTORE" ||
                    data.type === "ZUKO_IAP_FINISH"
                  ) {
                    void handleIapMessage(data);
                    return;
                  }
                  if (data.type === "ZUKO_MEDIA_PERMISSION_REQUEST") {
                    const requestId = String(data.requestId || "");
                    if (!requestId || Platform.OS !== "android") return;
                    void (async () => {
                      let granted = false;
                      let error = "Camera and microphone permission was denied.";
                      try {
                        const result = await PermissionsAndroid.requestMultiple([
                          PermissionsAndroid.PERMISSIONS.CAMERA,
                          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                        ]);
                        granted =
                          result[PermissionsAndroid.PERMISSIONS.CAMERA] ===
                            PermissionsAndroid.RESULTS.GRANTED &&
                          result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
                            PermissionsAndroid.RESULTS.GRANTED;
                        if (!granted) {
                          error =
                            "Allow camera and microphone in Android Settings to start a video call.";
                        }
                      } catch {
                        error = "Android could not request camera and microphone permission.";
                      }
                      webRef.current?.injectJavaScript(`
(function(){
  window.dispatchEvent(new CustomEvent('zuko:media-permission', {
    detail: ${JSON.stringify({ requestId, granted, error })}
  }));
})();
true;`);
                    })();
                    return;
                  }
                  if (data.type === "ZUKO_BACK_AT_ROOT") {
                    BackHandler.exitApp();
                  }
                  if (data.type === "ZUKO_BACK_RESULT") {
                    if (!data.handled) {
                      if (canGoBackRef.current) {
                        webRef.current?.goBack();
                      } else {
                        BackHandler.exitApp();
                      }
                    }
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
      <StatusBar style="light" />
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
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,13,18,0.72)",
    gap: 10,
  },
});
