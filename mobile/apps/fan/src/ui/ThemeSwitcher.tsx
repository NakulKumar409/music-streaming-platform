import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Palette } from 'lucide-react-native';
import ThemeSelectionModal from './ThemeSelectionModal';
import { useTheme } from '../providers/ThemeProvider';

export { default as ThemeSelectionModal } from './ThemeSelectionModal';

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={styles.triggerButton}
        activeOpacity={0.7}
        accessibilityLabel="Theme Selector"
      >
        <Palette size={18} color={theme?.primary || '#E85D2C'} />
      </TouchableOpacity>

      <ThemeSelectionModal visible={isOpen} onClose={() => setIsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 999,
  },
  triggerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
});
