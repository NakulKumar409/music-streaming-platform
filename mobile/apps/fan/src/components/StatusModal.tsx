import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '../theme';

export interface StatusModalProps {
  visible: boolean;
  onClose: () => void;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconBorderColor?: string;
  title: string;
  message?: string;
  details?: React.ReactNode;
  primaryButtonText?: string;
  onPrimaryPress?: () => void;
  primaryButtonColor?: string;
  primaryButtonTextColor?: string;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  linkText?: string;
  onLinkPress?: () => void;
  buttonLayout?: 'column' | 'row';
}

export default function StatusModal({
  visible,
  onClose,
  icon,
  iconBgColor = 'rgba(255, 122, 24, 0.15)',
  iconBorderColor = 'rgba(255, 122, 24, 0.3)',
  title,
  message,
  details,
  primaryButtonText = 'OK',
  onPrimaryPress,
  primaryButtonColor = Colors.accent,
  primaryButtonTextColor = '#000000',
  secondaryButtonText,
  onSecondaryPress,
  linkText,
  onLinkPress,
  buttonLayout = 'column',
}: StatusModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {Platform.OS !== 'web' ? (
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {icon ? (
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: iconBgColor,
                      borderColor: iconBorderColor,
                    },
                  ]}>
                  {icon}
                </View>
              ) : null}

              <Text style={styles.title}>{title}</Text>

              {message ? <Text style={styles.message}>{message}</Text> : null}

              {details ? <View style={styles.detailsContainer}>{details}</View> : null}

              <View
                style={[
                  styles.buttonContainer,
                  buttonLayout === 'row' ? styles.buttonRow : styles.buttonColumn,
                ]}>
                {secondaryButtonText ? (
                  <Pressable
                    style={[
                      styles.btn,
                      buttonLayout === 'row' ? styles.btnHalf : styles.btnFull,
                      styles.secondaryBtn,
                    ]}
                    onPress={onSecondaryPress || onClose}>
                    <Text style={styles.secondaryBtnText}>{secondaryButtonText}</Text>
                  </Pressable>
                ) : null}

                {primaryButtonText ? (
                  <Pressable
                    style={[
                      styles.btn,
                      buttonLayout === 'row' ? styles.btnHalf : styles.btnFull,
                      { backgroundColor: primaryButtonColor },
                    ]}
                    onPress={onPrimaryPress || onClose}>
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: primaryButtonTextColor },
                      ]}>
                      {primaryButtonText}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {linkText ? (
                <Pressable
                  style={styles.linkWrap}
                  onPress={onLinkPress || onClose}
                  hitSlop={10}>
                  <Text style={styles.linkText}>{linkText}</Text>
                </Pressable>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161618',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
    marginBottom: 20,
  },
  detailsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnFull: {
    width: '100%',
  },
  btnHalf: {
    flex: 1,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  linkWrap: {
    marginTop: 14,
    paddingVertical: 4,
  },
  linkText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
