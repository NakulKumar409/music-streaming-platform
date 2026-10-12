import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home as HomeIcon, Search, Music, PlayCircle, User } from 'lucide-react-native';
import { useTheme } from '../providers/ThemeProvider';

export type BottomNavTab = 'home' | 'search' | 'audio' | 'video' | 'account';

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
  activeTab = 'home',
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  const handlePress = (tab: BottomNavTab) => {
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

  const { theme } = useTheme();
  const primaryColor = theme?.primary || '#7C3AED';
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);

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
            borderColor: `${primaryColor}45`,
            shadowColor: primaryColor,
          },
          webGlassStyle,
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const iconColor = isActive ? '#FFFFFF' : '#8E8E9F';
          const labelColor = isActive ? '#FFFFFF' : '#8E8E9F';
          const Icon = tab.icon;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handlePress(tab.key)}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View
                style={[
                  styles.iconContainer,
                  isActive && [
                    styles.activeIconPill,
                    {
                      backgroundColor: primaryColor,
                      shadowColor: primaryColor,
                    },
                  ],
                ]}
              >
                <Icon color={iconColor} size={20} />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: labelColor },
                  isActive && styles.activeTabLabel,
                ]}
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

const webGlassStyle =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow:
          '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 16px rgba(124, 58, 237, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
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
    width: '92%',
    maxWidth: 440,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 12, 26, 0.88)',
    borderWidth: 1.2,
    borderColor: 'rgba(139, 92, 246, 0.38)',
    paddingHorizontal: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconPill: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  activeTabLabel: {
    fontWeight: '700',
  },
});

