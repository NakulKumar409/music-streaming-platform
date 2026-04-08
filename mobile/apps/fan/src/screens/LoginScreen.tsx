import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff } from 'lucide-react-native';
import { Shadow } from 'react-native-shadow-2';

import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../store/authStore';
import { Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation, route }: Props) {
  const { login, isLoggingIn } = useAuth();
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const webViewportStyle = Platform.OS === 'web' ? { width, height } : null;

  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const prefillEmail = route?.params?.prefillEmail;
    if (typeof prefillEmail === 'string' && prefillEmail.trim()) {
      setEmail(prefillEmail.trim());
    }
  }, [route?.params?.prefillEmail]);

  const canSubmit = useMemo(
    () => email.trim() && password && !isLoggingIn,
    [email, password, isLoggingIn]
  );

  const onSubmit = async () => {
    setErrorText('');

    if (!email.trim() || !password) {
      setErrorText('Please enter your email and password.');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;
      
      let message = 
        typeof serverMessage === 'string'
          ? serverMessage
          : status === 403
            ? 'Access forbidden.'
            : status === 401
              ? 'Invalid credentials.'
              : err?.message || 'Login failed';

      // Specific check for device limit
      if (message.toLowerCase().includes('device limit')) {
        message = 'Device Limit Reached: You can only have 2 active sessions. Please log out from another device.';
      }

      setErrorText(message);
      if (isNative) Alert.alert('Login Error', message);
    }
  };

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  return (
    <LinearGradient
      colors={Colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bg, webViewportStyle]}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          style={styles.overlay}
        >
          {isNative ? (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.content,
                    isDesktop ? styles.contentDesktop : styles.contentMobile,
                  ]}
                >
                  <Shadow
                    distance={40}
                    startColor="rgba(255, 69, 0, 0.25)"
                    offset={[0, 0]}
                  >
                    <View
                      style={[
                        styles.logoWrapper,
                        isDesktop && styles.logoWrapperDesktop,
                      ]}
                    >
                      <Image
                        source={require('../logo.jpg')}
                        style={styles.logoImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.4)']}
                        style={styles.logoInnerGradient}
                      />
                    </View>
                  </Shadow>

                  <BlurView intensity={25} tint="dark" style={[styles.cardBlur, isDesktop && styles.cardBlurDesktop]}>
                    <View style={[styles.cardInner, isDesktop && styles.cardInnerDesktop]}>
                      <Text style={styles.title}>Login to Fan App</Text>
                      {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

                      <Text style={styles.label}>Username</Text>
                      <View style={styles.inputGlass}>
                        <TextInput
                          placeholder="Email"
                          placeholderTextColor={Colors.textMuted}
                          style={styles.input}
                          value={email}
                          onChangeText={(t) => {
                            setEmail(t);
                            if (errorText) setErrorText('');
                          }}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          returnKeyType="next"
                        />
                      </View>

                      <Text style={styles.label}>Password</Text>
                      <View style={styles.passwordContainer}>
                        <TextInput
                          placeholder="Password"
                          placeholderTextColor={Colors.textMuted}
                          style={styles.passwordInput}
                          secureTextEntry={!isPasswordVisible}
                          value={password}
                          onChangeText={(t) => {
                            setPassword(t);
                            if (errorText) setErrorText('');
                          }}
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={() => {
                            if (canSubmit) void onSubmit();
                          }}
                        />
                        <Pressable
                          onPress={() => setIsPasswordVisible((v) => !v)}
                          hitSlop={10}
                          style={styles.eyeButton}
                        >
                          {isPasswordVisible ? (
                            <EyeOff color={Colors.textPrimary} size={18} />
                          ) : (
                            <Eye color={Colors.textPrimary} size={18} />
                          )}
                        </Pressable>
                      </View>

                      <Pressable onPress={() => undefined} hitSlop={10} style={styles.forgotWrap}>
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                      </Pressable>

                      <Pressable onPress={onSubmit} disabled={!canSubmit}>
                        <View style={styles.buttonGlass}>
                          <LinearGradient colors={[Colors.accent, Colors.accent]} style={styles.button}>
                            {isLoggingIn ? (
                              <ActivityIndicator color="#000" />
                            ) : (
                              <Text style={styles.btnText}>Login</Text>
                            )}
                          </LinearGradient>
                        </View>
                      </Pressable>

                      <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={10}>
                        <Text style={styles.link}>Create account</Text>
                      </Pressable>
                    </View>
                  </BlurView>
                </View>
              </ScrollView>
            </TouchableWithoutFeedback>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.content,
                  isDesktop ? styles.contentDesktop : styles.contentMobile,
                ]}
              >
                <Shadow
                  distance={40}
                  startColor="rgba(255, 69, 0, 0.25)"
                  offset={[0, 0]}
                >
                  <View
                    style={[
                      styles.logoWrapper,
                      isDesktop && styles.logoWrapperDesktop,
                    ]}
                  >
                    <Image
                      source={require('../logo.jpg')}
                      style={styles.logoImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)']}
                      style={styles.logoInnerGradient}
                    />
                  </View>
                </Shadow>

                <BlurView intensity={25} tint="dark" style={[styles.cardBlur, isDesktop && styles.cardBlurDesktop]}>
                  <View style={[styles.cardInner, isDesktop && styles.cardInnerDesktop]}>
                    <Text style={styles.title}>Login to Fan App</Text>
                    {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

                    <Text style={styles.label}>Username</Text>
                    <View style={styles.inputGlass}>
                      <TextInput
                        placeholder="Email"
                        placeholderTextColor={Colors.textMuted}
                        style={styles.input}
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          if (errorText) setErrorText('');
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        returnKeyType="next"
                      />
                    </View>

                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        placeholder="Password"
                        placeholderTextColor={Colors.textMuted}
                        style={styles.passwordInput}
                        secureTextEntry={!isPasswordVisible}
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          if (errorText) setErrorText('');
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (canSubmit) void onSubmit();
                        }}
                      />
                      <Pressable
                        onPress={() => setIsPasswordVisible((v) => !v)}
                        hitSlop={10}
                        style={styles.eyeButton}
                      >
                        {isPasswordVisible ? (
                          <EyeOff color={Colors.textPrimary} size={18} />
                        ) : (
                          <Eye color={Colors.textPrimary} size={18} />
                        )}
                      </Pressable>
                    </View>

                    <Pressable onPress={() => undefined} hitSlop={10} style={styles.forgotWrap}>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </Pressable>

                    <Pressable onPress={onSubmit} disabled={!canSubmit}>
                      <View style={styles.buttonGlass}>
                        <LinearGradient colors={[Colors.accent, Colors.accent]} style={styles.button}>
                          {isLoggingIn ? (
                            <ActivityIndicator color="#000" />
                          ) : (
                            <Text style={styles.btnText}>Login</Text>
                          )}
                        </LinearGradient>
                      </View>
                    </Pressable>

                    <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={10}>
                      <Text style={styles.link}>Create account</Text>
                    </Pressable>
                  </View>
                </BlurView>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 24,
    paddingBottom: 32,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  contentMobile: {
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 440,
  },
  logoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 30,
  },
  logoWrapperDesktop: {
    width: 120,
    height: 120,
    borderRadius: 26,
    marginBottom: 24,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoInnerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardBlur: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cardBlurDesktop: {
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 40px rgba(0,0,0,0.45)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
      },
    }),
  },
  cardInner: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 20,
    borderRadius: 24,
  },
  cardInnerDesktop: {
    padding: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputGlass: {
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    padding: 14,
    color: Colors.textPrimary,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    paddingRight: 44,
    color: Colors.textPrimary,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  buttonGlass: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 16,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 6,
  },
  forgotText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  link: {
    color: Colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  errorText: {
    marginTop: -8,
    marginBottom: 12,
    color: '#FF4D4F',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
