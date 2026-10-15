import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Check, X, Palette, Sparkles } from 'lucide-react-native';
import { useTheme } from '../providers/ThemeProvider';
import { type ThemeDefinition } from '../config/themeConfig';

interface ThemeSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ThemeSelectionModal({ visible, onClose }: ThemeSelectionModalProps) {
  const { theme, themeId, setTheme, themes } = useTheme();

  const handleSelectTheme = (id: string) => {
    void setTheme(id);
  };

  const renderThemeItem = ({ item }: { item: ThemeDefinition }) => {
    const isActive = item.id === themeId;

    return (
      <TouchableOpacity
        onPress={() => handleSelectTheme(item.id)}
        style={[
          styles.themeCard,
          isActive && [
            styles.themeCardActive,
            {
              borderColor: item.primary,
              backgroundColor: `${item.primary}18`,
            },
          ],
        ]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Select ${item.name} theme`}
        accessibilityState={{ selected: isActive }}
      >
        <View style={styles.themeLeft}>
          {/* Visual Color Preview Swatch */}
          <View style={[styles.swatchContainer, { borderColor: `${item.primary}40` }]}>
            <View style={[styles.swatchPrimary, { backgroundColor: item.primary }]} />
            <View style={[styles.swatchSecondary, { backgroundColor: item.secondary }]} />
          </View>

          <View style={styles.themeMeta}>
            <Text style={[styles.themeName, isActive && { color: '#FFFFFF', fontWeight: '700' }]}>
              {item.name}
            </Text>
            <View style={styles.colorPillRow}>
              <View style={[styles.miniDot, { backgroundColor: item.accent }]} />
              <Text style={styles.themeHexLabel}>
                {item.id === 'midnight-black' ? 'Dark Minimal' : item.id.replace('-', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Selected Indicator */}
        <View
          style={[
            styles.indicatorBadge,
            isActive
              ? { backgroundColor: item.primary, borderColor: item.primary }
              : styles.indicatorBadgeInactive,
          ]}
        >
          {isActive ? (
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          ) : (
            <View style={styles.inactiveDot} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalSheet, { borderColor: `${theme.primary}35` }]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <View style={[styles.headerIconWrap, { backgroundColor: `${theme.primary}22` }]}>
                    <Palette size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={styles.title}>Choose Theme</Text>
                    <Text style={styles.subtitle}>Select your preferred appearance preset</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Close theme selector"
                >
                  <X size={18} color="#8E8E9F" />
                </TouchableOpacity>
              </View>

              {/* Theme List */}
              <FlatList
                data={themes}
                keyExtractor={(item) => item.id}
                renderItem={renderThemeItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={true}
                bounces={Platform.OS !== 'web'}
                style={styles.flatList}
              />

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.doneButton, { backgroundColor: theme.primary }]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: Math.min(windowHeight * 0.85, 620),
    backgroundColor: '#100D1A',
    borderRadius: 24,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E9F',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatList: {
    maxHeight: 440,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  themeCardActive: {
    borderWidth: 1.5,
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  swatchContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1.5,
  },
  swatchPrimary: {
    flex: 1,
    height: '100%',
  },
  swatchSecondary: {
    flex: 1,
    height: '100%',
  },
  themeMeta: {
    justifyContent: 'center',
  },
  themeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D4D4E0',
    letterSpacing: 0.1,
  },
  colorPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  themeHexLabel: {
    fontSize: 11,
    color: '#7E7E92',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  indicatorBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  indicatorBadgeInactive: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'transparent',
  },
  inactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  doneButton: {
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
