import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home as HomeIcon, Search, Music, PlayCircle, User } from 'lucide-react-native';
import { useTheme } from '../providers/ThemeProvider';

export type BottomNavTab = 'home' | 'search' | 'audio' | 'video' | 'account';

const ACTIVE_BLUE = '#0082FF';

interface BottomNavigationProps {
  onAction?: () => void;
  onHomePress?: () => void;
  onSearchPress?: () => void;
  onAudioPress?: () => void;
  onVideoPress?: () => void;
  onAccountPress?: () => void;
  activeTab?: BottomNavTab;
}

export default function BottomNavigation({
  onAction,
  onHomePress,
  onSearchPress,
  onAudioPress,
  onVideoPress,
  onAccountPress,
  activeTab: activeTabProp,
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();

  // Controlled or uncontrolled active tab state
  const [internalTab, setInternalTab] = useState<BottomNavTab>(activeTabProp || 'home');

  useEffect(() => {
    if (activeTabProp !== undefined) {
      setInternalTab(activeTabProp);
    }
  }, [activeTabProp]);

  // In native mobile app, landscape orientation is exclusively used for full-screen video playback.
  // The bottom navigation tab bar must be completely hidden in landscape mode.
  // Note: Placed after all Hooks to ensure consistent hook call order.
  if (Platform.OS !== 'web' && width > height) {
    return null;
  }

  const currentActiveTab = activeTabProp !== undefined ? activeTabProp : internalTab;

  // Use the theme's primary accent color across all 5 tabs
  const activeColor = theme?.primary || ACTIVE_BLUE;

  const capsuleBg = theme?.bgRgb
    ? `rgba(${theme.bgRgb.split(' ').join(', ')}, 0.90)`
    : 'rgba(10, 18, 36, 0.90)';

  const webGlass =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 18px ${activeColor}38, inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
        } as any)
      : undefined;

  const handlePress = (tab: BottomNavTab) => {
    setInternalTab(tab);
    switch (tab) {
      case 'home':
        if (onHomePress) onHomePress();
        break;
      case 'search':
        if (onSearchPress) onSearchPress();
        else if (onAction) onAction();
        break;
      case 'audio':
        if (onAudioPress) onAudioPress();
        else if (onAction) onAction();
        break;
      case 'video':
        if (onVideoPress) onVideoPress();
        else if (onAction) onAction();
        break;
      case 'account':
        if (onAccountPress) onAccountPress();
        else if (onAction) onAction();
        break;
    }
  };

  const tabs: {
    key: BottomNavTab;
    label: string;
    icon: React.ComponentType<{ color: string; size: number }>;
  }[] = [
    { key: 'home', label: 'Home', icon: HomeIcon },
    { key: 'search', label: 'Search', icon: Search },
    { key: 'audio', label: 'Audio', icon: Music },
    { key: 'video', label: 'Video', icon: PlayCircle },
    { key: 'account', label: 'Account', icon: User },
  ];

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: bottomInset,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: capsuleBg,
            borderColor: `${activeColor}40`,
            shadowColor: activeColor,
          },
          webGlass,
        ]}
      >
        {tabs.map((tab) => {
          const isActive = currentActiveTab === tab.key;
          const iconColor = isActive ? '#FFFFFF' : '#8E8E9F';
          const labelColor = isActive ? '#FFFFFF' : '#8E8E9F';
          const Icon = tab.icon;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handlePress(tab.key)}
              style={[styles.tabItem, webPressableReset]}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View
                style={[
                  styles.iconContainer,
                  isActive
                    ? [
                        styles.activeIconPill,
                        {
                          backgroundColor: activeColor,
                          shadowColor: activeColor,
                        },
                      ]
                    : styles.inactiveIconContainer,
                ]}
              >
                <Icon color={iconColor} size={isActive ? 19 : 20} />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: labelColor },
                  isActive && styles.activeTabLabel,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const webPressableReset =
  Platform.OS === 'web'
    ? ({
        outline: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        cursor: 'pointer',
      } as any)
    : undefined;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '94%',
    maxWidth: 440,
    height: 66,
    borderRadius: 36,
    backgroundColor: 'rgba(10, 18, 36, 0.90)',
    borderWidth: 1.2,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 48,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inactiveIconContainer: {
    backgroundColor: 'transparent',
  },
  activeIconPill: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 5,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  activeTabLabel: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
