import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Palette, Check } from 'lucide-react-native';
import { themes, applyTheme, DEFAULT_THEME_ID } from '../config/themeConfig';

export default function ThemeSwitcher() {
  if (Platform.OS !== 'web') return null;

  const [isOpen, setIsOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    const savedTheme = localStorage.getItem('global-theme') || DEFAULT_THEME_ID;
    setCurrentThemeId(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const handleSelectTheme = (id: string) => {
    setCurrentThemeId(id);
    localStorage.setItem('global-theme', id);
    applyTheme(id);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={styles.triggerButton}
        activeOpacity={0.7}
      >
        <Palette size={20} color="var(--color-primary)" />
        <Text style={styles.triggerText}>Theme</Text>
      </TouchableOpacity>

      {isOpen && (
        <Modal
          transparent
          visible={true}
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.dropdown}>
                  <View style={styles.dropdownHeader}>
                    <Text style={styles.dropdownTitle}>Select Theme</Text>
                  </View>
                  <FlatList
                    data={themes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                      const isActive = item.id === currentThemeId;
                      return (
                        <TouchableOpacity
                          onPress={() => handleSelectTheme(item.id)}
                          style={[
                            styles.itemButton,
                            isActive && styles.itemButtonActive,
                          ]}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.colorPreview,
                              { backgroundColor: item.primary },
                            ]}
                          />
                          <Text style={styles.itemText}>{item.name}</Text>
                          {isActive && (
                            <Check size={16} color="var(--color-primary)" />
                          )}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 999,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  triggerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  dropdown: {
    width: 260,
    maxHeight: 380,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  dropdownHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 4,
  },
  dropdownTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingVertical: 4,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 12,
    marginBottom: 2,
  },
  itemButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  colorPreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  itemText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
});
