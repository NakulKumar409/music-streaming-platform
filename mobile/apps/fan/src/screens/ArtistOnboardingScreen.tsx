import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Crown,
  Library,
  CreditCard,
  User,
  Check,
  PlayCircle,
  BadgeCheck,
} from 'lucide-react-native';
import { Colors } from '../theme';
import { ARTIST_WEB_URL } from '../config/env';

const { width } = Dimensions.get('window');

// 1. HERO SECTION & TRUST INDICATORS
const HeroSection = () => {
  return (
    <View style={styles.heroContainer}>
      <Text style={styles.heroTitle}>Become an Artist</Text>
      <Text style={styles.heroSubtitle}>
        Upload your music, grow your audience, and earn from your content
      </Text>
      
      <View style={styles.trustBadgesRow}>
        <View style={styles.trustBadge}>
          <Check size={14} color={Colors.accent} />
          <Text style={styles.trustBadgeText}>Fast Approval</Text>
        </View>
        <View style={styles.trustBadge}>
          <BadgeCheck size={14} color={Colors.accent} />
          <Text style={styles.trustBadgeText}>Secure Uploads</Text>
        </View>
        <View style={styles.trustBadge}>
          <Crown size={14} color={Colors.accent} />
          <Text style={styles.trustBadgeText}>Real-Time Analytics</Text>
        </View>
      </View>
    </View>
  );
};

// 2. BENEFITS SECTION
const BenefitsSection = () => {
  const benefits = [
    { id: 1, title: 'Upload songs easily', icon: <Library size={24} color={Colors.accent} /> },
    { id: 2, title: 'Track performance analytics', icon: <Crown size={24} color={Colors.accent} /> },
    { id: 3, title: 'Earn from subscriptions', icon: <CreditCard size={24} color={Colors.accent} /> },
    { id: 4, title: 'Reach real listeners', icon: <User size={24} color={Colors.accent} /> },
  ];

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>What You Get</Text>
      <View style={styles.benefitsGrid}>
        {benefits.map((b) => (
          <View key={b.id} style={styles.benefitCard}>
            <View style={styles.benefitIconWrap}>{b.icon}</View>
            <Text style={styles.benefitTitle}>{b.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// 3. HOW IT WORKS
const HowItWorksSection = () => {
  const steps = [
    { num: '1', title: 'Create your account', desc: 'Sign up in seconds' },
    { num: '2', title: 'Upload your first song', desc: 'Share your unreleased tracks' },
    { num: '3', title: 'Get approved', desc: 'Quick platform review' },
    { num: '4', title: 'Start growing', desc: 'Reach thousands of fans' },
  ];

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>How It Works</Text>
      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View key={step.num} style={styles.timelineItem}>
            <View style={styles.timelineNode}>
              <Text style={styles.timelineNodeText}>{step.num}</Text>
            </View>
            {index !== steps.length - 1 && <View style={styles.timelineLine} />}
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>{step.title}</Text>
              <Text style={styles.timelineDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// 7. OPTIONAL: EARNINGS PREVIEW
const EarningsPreview = () => {
  return (
    <View style={styles.sectionContainer}>
      <LinearGradient
        colors={['rgba(255,106,0,0.15)', 'rgba(255,106,0,0.02)']}
        style={styles.earningsCard}
      >
        <Text style={styles.earningsTitle}>Your Earning Potential</Text>
        <View style={styles.earningsRow}>
          <User size={20} color="#fff" />
          <Text style={styles.earningsMath}>10 fans @ $10/mo = </Text>
          <Text style={styles.earningsTotal}>$100 / month</Text>
        </View>
        <Text style={styles.earningsDesc}>
          Set your own subscription price and build a sustainable career on your own terms.
        </Text>
      </LinearGradient>
    </View>
  );
};

// 5. MOTIVATION SECTION
const MotivationSection = () => {
  return (
    <View style={styles.motivationContainer}>
      <PlayCircle size={48} color={Colors.accent} style={{ marginBottom: 16 }} />
      <Text style={styles.motivationTitle}>Start your music journey today</Text>
      <Text style={styles.motivationDesc}>
        Thousands of listeners are waiting for your sound.
      </Text>
    </View>
  );
};

export default function ArtistOnboardingScreen() {
  const insets = useSafeAreaInsets();

  const handleStartUploading = async () => {
    const artistUrl = ARTIST_WEB_URL + '/artist/landing';

    // Check if the URL can be opened
    const canOpen = await Linking.canOpenURL(artistUrl);
    if (!canOpen) {
      Alert.alert(
        'Cannot Open Artist Dashboard',
        'The artist dashboard URL is not accessible. Please ensure:\n\n1. The web-artist server is running (npm run dev in web-artist folder)\n2. Your device is on the same network as the server\n3. The EXPO_PUBLIC_ARTIST_WEB_URL in .env points to the correct server IP (not localhost)',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Linking.openURL(artistUrl).catch((err) => {
      console.error('Failed to open web url', err);
      Alert.alert(
        'Error Opening Dashboard',
        'Failed to open the artist dashboard. Please check that the server is running and try again.',
        [{ text: 'OK', style: 'default' }]
      );
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1a0f0a', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={styles.gradientBackground}
      />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
      >
        <HeroSection />
        <BenefitsSection />
        <EarningsPreview />
        <HowItWorksSection />
        <MotivationSection />
      </ScrollView>

      {/* 6. CTA IMPROVEMENT: Sticky Bottom CTA */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={handleStartUploading}
        >
          <LinearGradient
            colors={['#ff6a00', '#d85200']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>Start Uploading Music 🚀</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140, // Space for sticky CTA
  },
  
  // Hero
  heroContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,106,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.2)',
  },
  trustBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Sections
  sectionContainer: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
  },
  
  // Benefits
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  benefitCard: {
    width: (width - 40 - 16) / 2, // 2 columns
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  benefitIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,106,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Timeline
  timeline: {
    paddingLeft: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,106,0,0.2)',
    borderWidth: 1,
    borderColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineNodeText: {
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 14,
  },
  timelineLine: {
    position: 'absolute',
    left: 15.5,
    top: 32,
    bottom: -24,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 1,
  },
  timelineContent: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  timelineTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },

  // Earnings
  earningsCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.2)',
  },
  earningsTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsMath: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  earningsTotal: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: '900',
  },
  earningsDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 20,
  },

  // Motivation
  motivationContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  motivationTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  motivationDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
  },

  // CTA
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  ctaButton: {
    width: '100%',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  ctaGradient: {
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
