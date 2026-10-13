import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { BRIDGE_SCRIPT, SITE_URL, decideNavigation, parseBridgeMessage, safeFileName } from "./src/web-shell";

const CANVAS = "#0c1220";
const BRAND = "#2dd4bf";

/** Writes a downloaded file and lets the person save or share it. */
async function deliverFile(name: string, mime: string, base64: string) {
  const fileName = safeFileName(name);
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const share = async () => {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: fileName });
    else Alert.alert("File ready", `${fileName} is ready, but this phone cannot share files.`);
  };
  if (Platform.OS !== "android") return share(); // iOS: the share sheet includes "Save to Files".
  Alert.alert("File ready", fileName, [
    { text: "Cancel", style: "cancel" },
    { text: "Share", onPress: () => void share() },
    {
      text: "Save to phone",
      onPress: async () => {
        try {
          const saf = FileSystem.StorageAccessFramework;
          const permission = await saf.requestDirectoryPermissionsAsync();
          if (!permission.granted) return;
          const target = await saf.createFileAsync(permission.directoryUri, fileName, mime);
          await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert("Saved", `${fileName} was saved to the folder you chose.`);
        } catch {
          Alert.alert("Not saved", "The file could not be saved there. Try “Share” instead.");
        }
      },
    },
  ]);
}

function Shell() {
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [progress, setProgress] = useState(0);
  const [offline, setOffline] = useState(false);
  const [preparing, setPreparing] = useState(false);

  // Android back button: go back in the website first, then leave the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current && web.current) {
        web.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const openOutside = useCallback((url: string) => {
    Linking.openURL(url).catch(() => Alert.alert("Cannot open", "No app on this phone can open that link."));
  }, []);

  const download = useCallback((url: string) => {
    web.current?.injectJavaScript(`window.__xelloDownload && window.__xelloDownload(${JSON.stringify(url)}); true;`);
  }, []);

  const onShouldStart = useCallback(
    (req: ShouldStartLoadRequest) => {
      if (req.isTopFrame === false) return true;
      const decision = decideNavigation(req.url);
      if (decision === "load") return true;
      if (decision === "download") download(req.url);
      else openOutside(req.url);
      return false;
    },
    [download, openOutside]
  );

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(event.nativeEvent.data);
    if (!msg) return;
    if (msg.type === "download-start") return setPreparing(true);
    setPreparing(false);
    if (msg.type === "download-error") return Alert.alert("Download failed", msg.message);
    try {
      await deliverFile(msg.name, msg.mime, msg.data);
    } catch {
      Alert.alert("Download failed", "The file could not be saved on this phone.");
    }
  }, []);

  const retry = () => {
    setOffline(false);
    setFirstLoad(true);
    web.current?.reload();
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="light" backgroundColor={CANVAS} />
      <WebView
        ref={web}
        source={{ uri: SITE_URL }}
        style={styles.web}
        containerStyle={styles.web}
        applicationNameForUserAgent="XelloTuitionApp/2.0"
        injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
        onShouldStartLoadWithRequest={onShouldStart}
        onOpenWindow={(e) => {
          // Links that open a new tab: our pages stay in the app, anything else opens outside.
          const url = e.nativeEvent.targetUrl;
          const decision = decideNavigation(url);
          if (decision === "load") web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
          else if (decision === "download") download(url);
          else openOutside(url);
        }}
        onMessage={onMessage}
        onNavigationStateChange={(nav) => {
          canGoBack.current = nav.canGoBack;
        }}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onLoadEnd={() => setFirstLoad(false)}
        onError={() => setOffline(true)}
        onRenderProcessGone={() => web.current?.reload()}
        onContentProcessDidTerminate={() => web.current?.reload()}
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        setSupportMultipleWindows
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        bounces={false}
        overScrollMode="never"
        cacheEnabled
        webviewDebuggingEnabled={__DEV__}
      />

      {progress > 0 && progress < 1 && !firstLoad && <View style={[styles.progress, { width: `${Math.round(progress * 100)}%` }]} />}

      {firstLoad && !offline && (
        <View style={styles.cover}>
          <Image source={require("./assets/icon.png")} style={styles.logo} />
          <Text style={styles.title}>Xello Tuition</Text>
          <ActivityIndicator color={BRAND} style={{ marginTop: 18 }} />
        </View>
      )}

      {offline && (
        <View style={styles.cover}>
          <Text style={styles.title}>Can’t reach Xello Tuition</Text>
          <Text style={styles.body}>Check that the phone has internet, then try again.</Text>
          <Pressable onPress={retry} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {preparing && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <ActivityIndicator color={CANVAS} />
          <Text style={styles.toastText}>Preparing the file…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CANVAS },
  web: { flex: 1, backgroundColor: CANVAS },
  progress: { position: "absolute", top: 0, left: 0, height: 3, backgroundColor: BRAND },
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: CANVAS, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { width: 84, height: 84, borderRadius: 42 },
  title: { marginTop: 16, color: "#f1f5f9", fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { marginTop: 8, color: "#cbd5e1", fontSize: 16, textAlign: "center", lineHeight: 22 },
  button: { marginTop: 20, minHeight: 48, paddingHorizontal: 24, borderRadius: 12, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  buttonText: { color: CANVAS, fontSize: 16, fontWeight: "700" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 24, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, backgroundColor: BRAND },
  toastText: { color: CANVAS, fontSize: 15, fontWeight: "600" },
});
