import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home as HomeIcon, Search, Music, PlayCircle, User } from 'lucide-react-native';

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

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          height: 84 + (insets.bottom > 10 ? insets.bottom - 10 : 0),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const color = isActive ? '#fff' : '#666';
        const Icon = tab.icon;

        return (
          <Pressable
            key={tab.key}
            onPress={() => handlePress(tab.key)}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <Icon color={color} size={24} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
  },
});

