import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme";

export type ToastTone = "success" | "info" | "warning" | "error";

export type ToastOptions = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastState = ToastOptions & {
  id: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_META: Record<
  ToastTone,
  {
    accent: string;
    soft: string;
    icon: typeof Info;
  }
> = {
  success: {
    accent: "#22C55E",
    soft: "rgba(34,197,94,0.16)",
    icon: CheckCircle2,
  },
  info: {
    accent: "#60A5FA",
    soft: "rgba(96,165,250,0.16)",
    icon: Info,
  },
  warning: {
    accent: "#F59E0B",
    soft: "rgba(245,158,11,0.16)",
    icon: AlertTriangle,
  },
  error: {
    accent: "#EF4444",
    soft: "rgba(239,68,68,0.16)",
    icon: XCircle,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const sequenceRef = useRef(0);
  const activeToastIdRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useRef(new Animated.Value(-18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const dismissToast = useCallback(() => {
    clearHideTimer();
    const dismissingId = activeToastIdRef.current;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && activeToastIdRef.current === dismissingId) {
        activeToastIdRef.current = null;
        setToast(null);
      }
    });
  }, [clearHideTimer, opacity, translateY]);

  const showToast = useCallback(
    (options: ToastOptions) => {
      clearHideTimer();
      const id = (sequenceRef.current += 1);
      activeToastIdRef.current = id;
      opacity.stopAnimation();
      translateY.stopAnimation();
      const durationMs = Math.max(
        1800,
        options.durationMs ?? (options.actionLabel ? 6000 : 3600)
      );

      setToast({
        ...options,
        id,
        tone: options.tone ?? "info",
        durationMs,
      });

      translateY.setValue(-18);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      hideTimerRef.current = setTimeout(() => {
        dismissToast();
      }, durationMs);
    },
    [clearHideTimer, dismissToast, opacity, translateY]
  );

  useEffect(
    () => () => {
      activeToastIdRef.current = null;
      clearHideTimer();
      opacity.stopAnimation();
      translateY.stopAnimation();
    },
    [clearHideTimer, opacity, translateY]
  );

  const value = React.useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast]
  );

  const tone = toast?.tone ?? "info";
  const meta = TONE_META[tone];
  const ToneIcon = meta.icon;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.host,
            {
              top:
                Math.max(insets.top, Platform.OS === "web" ? 12 : 8) +
                (Platform.OS === "web" ? 10 : 4),
            },
          ]}>
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.card,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}>
            <LinearGradient
              colors={["rgba(28,28,31,0.98)", "rgba(12,12,14,0.98)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: meta.soft,
                    borderColor: meta.accent,
                  },
                ]}>
                <ToneIcon size={19} color={meta.accent} strokeWidth={2.2} />
              </View>

              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={1}>
                  {toast.title}
                </Text>
                {toast.message ? (
                  <Text style={styles.message} numberOfLines={2}>
                    {toast.message}
                  </Text>
                ) : null}
              </View>

              {toast.actionLabel && toast.onAction ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={toast.actionLabel}
                  onPress={() => {
                    const action = toast.onAction;
                    dismissToast();
                    action?.();
                  }}
                  style={({ pressed }) => [
                    styles.action,
                    pressed && styles.actionPressed,
                  ]}>
                  <Text style={[styles.actionText, { color: Colors.accent }]}>
                    {toast.actionLabel}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                hitSlop={8}
                onPress={dismissToast}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.closePressed,
                ]}>
                <X size={17} color="rgba(255,255,255,0.62)" />
              </Pressable>
            </LinearGradient>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 14,
  },
  gradient: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  message: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  action: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    flexShrink: 0,
  },
  closePressed: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
});
