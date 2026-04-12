import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, Eye, EyeOff } from 'lucide-react-native';

import type { RootStackParamList } from '../navigation/types';
import { apiV1 } from '../services/api';
import { useAuth } from '../store/authStore';
import { Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

type FavoriteGenre = 'Pop' | 'Hip-Hop' | 'Sufi' | 'Rock' | 'EDM' | 'Other';
const GENRES: FavoriteGenre[] = ['Pop', 'Hip-Hop', 'Sufi', 'Rock', 'EDM', 'Other'];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function SignupScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const webViewportStyle = Platform.OS === 'web' ? { width, height } : null;

  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState('');

  // Step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 2
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  // Step 3
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [favoriteGenre, setFavoriteGenre] = useState<FavoriteGenre | ''>('');
  const [isGenreOpen, setIsGenreOpen] = useState(false);

  // Step 4 Actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const onNextStep = () => {
    setStepError('');
    if (currentStep === 1) {
      if (!fullName.trim() || !email.trim() || !phoneNumber.trim()) {
        setStepError('Please fill in all basic information fields.');
        return;
      }
      if (!isValidEmail(email)) {
        setStepError('Please enter a valid email address.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!username.trim() || !password || !confirmPassword) {
        setStepError('Please fill in all security details.');
        return;
      }
      if (password !== confirmPassword) {
        setStepError("Passwords don't match.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!dateOfBirth.trim() || !favoriteGenre || !locationCity.trim()) {
        setStepError('Please complete your personalization profile.');
        return;
      }
      setCurrentStep(4);
    }
  };

  const onBack = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const onSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError('');

    const normalizedEmail = email.trim().toLowerCase();
    setIsSubmitting(true);
    try {
      await apiV1.post('/auth/register', {
        fullName: fullName.trim(),
        email: normalizedEmail,
        phoneNumber: phoneNumber.trim(),
        username: username.trim(),
        password,
        dateOfBirth: dateOfBirth.trim(),
        favoriteGenre,
        locationCity: locationCity.trim(),
      });

      await login(normalizedEmail, password);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message ?? err?.response?.data?.error;

      if (
        status === 400 &&
        typeof serverMessage === 'string' &&
        serverMessage.toLowerCase().includes('email already exists')
      ) {
        setSubmitError('This email is already registered. Please login.');
        return;
      }

      const message =
        typeof serverMessage === 'string'
          ? serverMessage
          : status === 400
            ? 'Registration failed. Please check your details.'
            : err?.message || 'Registration failed.';
      setSubmitError(message);
      Alert.alert('Sign Up Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  const renderProgressIndicator = () => {
    const steps = [1, 2, 3, 4];
    return (
      <View style={styles.progressContainer}>
        {steps.map((step, idx) => (
          <React.Fragment key={step}>
            <View
              style={[
                styles.progressDot,
                step === currentStep && styles.progressDotActive,
                step < currentStep && styles.progressDotCompleted,
              ]}
            >
              {step < currentStep ? (
                <Check color="#000" size={12} strokeWidth={4} />
              ) : (
                <Text
                  style={[
                    styles.progressDotText,
                    step === currentStep && styles.progressDotTextActive,
                  ]}
                >
                  {step}
                </Text>
              )}
            </View>
            {idx < steps.length - 1 && (
              <View
                style={[
                  styles.progressLine,
                  step < currentStep && styles.progressLineCompleted,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Basic Information</Text>
            
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputGlass}>
              <TextInput
                placeholder="Your full name"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                value={fullName}
                onChangeText={(t) => {
                  setFullName(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputGlass}>
              <TextInput
                placeholder="Email address"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputGlass}>
              <TextInput
                placeholder="Phone number"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                value={phoneNumber}
                onChangeText={(t) => {
                  setPhoneNumber(t);
                  if (stepError) setStepError('');
                }}
                keyboardType={Platform.select({ ios: 'number-pad', default: 'phone-pad' })}
              />
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Account Security</Text>

            <Text style={styles.label}>Username</Text>
            <View style={styles.inputGlass}>
              <TextInput
                placeholder="Choose a username"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Secure password"
                placeholderTextColor={Colors.textMuted}
                style={styles.passwordInput}
                secureTextEntry={!isPasswordVisible}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
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

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Repeat password"
                placeholderTextColor={Colors.textMuted}
                style={styles.passwordInput}
                secureTextEntry={!isConfirmPasswordVisible}
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setIsConfirmPasswordVisible((v) => !v)}
                hitSlop={10}
                style={styles.eyeButton}
              >
                {isConfirmPasswordVisible ? (
                  <EyeOff color={Colors.textPrimary} size={18} />
                ) : (
                  <Eye color={Colors.textPrimary} size={18} />
                )}
              </Pressable>
            </View>
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Personalization</Text>

            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.inputGlass}>
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                value={dateOfBirth}
                onChangeText={(t) => {
                  setDateOfBirth(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Favorite Genre</Text>
            <Pressable
              onPress={() => setIsGenreOpen((v) => !v)}
              style={styles.selectInput}
            >
              <Text style={styles.selectText} numberOfLines={1}>
                {favoriteGenre ? favoriteGenre : 'Select a genre'}
              </Text>
              <Text style={styles.selectCaret}>▾</Text>
            </Pressable>

            {isGenreOpen && (
              <View style={styles.selectDropdown}>
                {GENRES.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => {
                      setFavoriteGenre(g);
                      setIsGenreOpen(false);
                      if (stepError) setStepError('');
                    }}
                    style={styles.selectOption}
                  >
                    <Text style={styles.selectOptionText}>{g}</Text>
                    {favoriteGenre === g ? (
                      <Check color={Colors.textPrimary} size={18} />
                    ) : (
                      <View style={{ width: 18, height: 18 }} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>Location (City)</Text>
            <View style={styles.inputGlass}>
              <TextInput
                placeholder="Your city"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                value={locationCity}
                onChangeText={(t) => {
                  setLocationCity(t);
                  if (stepError) setStepError('');
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.stepTitle}>Preview Details</Text>
            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Name:</Text>
                <Text style={styles.previewValue}>{fullName}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Email:</Text>
                <Text style={styles.previewValue}>{email}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Phone:</Text>
                <Text style={styles.previewValue}>{phoneNumber}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Username:</Text>
                <Text style={styles.previewValue}>{username}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>DoB:</Text>
                <Text style={styles.previewValue}>{dateOfBirth}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Genre:</Text>
                <Text style={styles.previewValue}>{favoriteGenre}</Text>
              </View>
              <View style={[styles.previewRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.previewLabel}>City:</Text>
                <Text style={styles.previewValue}>{locationCity}</Text>
              </View>
            </View>
            {!!submitError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTextInsideBig}>{submitError}</Text>
                {submitError.includes('already registered') && (
                  <Pressable onPress={() => navigation.navigate('Login', { prefillEmail: email })}>
                    <Text style={styles.errorLink}>Go to Login</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        );
    }
  };

  return (
    <LinearGradient
      colors={Colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bg, webViewportStyle]}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          style={styles.overlay}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.content, isDesktop ? styles.contentDesktop : styles.contentMobile]}>
              <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
                <ArrowLeft color={Colors.textPrimary} size={22} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <BlurView intensity={25} tint="dark" style={[styles.cardBlur, isDesktop && styles.cardBlurDesktop]}>
                <View style={[styles.cardInner, isDesktop && styles.cardInnerDesktop]}>
                  <Text style={styles.title}>Create Account</Text>
                  
                  {renderProgressIndicator()}
                  
                  <View style={styles.stepContentWrap}>
                    {renderStepContent()}
                  </View>

                  {/* Inline Step Error */}
                  {!!stepError && <Text style={styles.errorText}>{stepError}</Text>}

                  <Pressable onPress={currentStep < 4 ? onNextStep : onSubmit}>
                    <View
                      style={[
                        styles.buttonWrap,
                        isSubmitting && styles.buttonWrapDisabled,
                      ]}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={styles.btnText}>
                          {currentStep < 4 ? (currentStep === 3 ? 'Preview Details' : 'Next Step') : 'Create Account'}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                </View>
              </BlurView>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  contentMobile: {
    alignItems: 'stretch',
  },
  contentDesktop: {
    alignSelf: 'center',
    width: 440,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardBlur: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBlurDesktop: {
    borderRadius: 26,
  },
  cardInner: {
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardInnerDesktop: {
    padding: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  progressDotActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  progressDotCompleted: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  progressDotText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
  },
  progressDotTextActive: {
    color: '#000000',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  progressLineCompleted: {
    backgroundColor: Colors.accent,
  },
  stepContentWrap: {
    minHeight: 280,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  inputGlass: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  passwordContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 2,
  },
  errorText: {
    marginTop: 12,
    color: '#FF4D4F',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255,77,79,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.3)',
    alignItems: 'center',
  },
  errorTextInsideBig: {
    color: '#FF4D4F',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorLink: {
    marginTop: 8,
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  selectInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  selectCaret: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  selectDropdown: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,18,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  selectOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  previewLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  previewValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  buttonWrap: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonWrapDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
});
