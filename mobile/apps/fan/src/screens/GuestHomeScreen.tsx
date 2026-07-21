import React, { useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text, StatusBar, Animated, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Headphones } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import AppHeader from '../components/AppHeader';
import HeroCarousel from '../components/HeroCarousel';
import SectionHeader from '../components/SectionHeader';
import ArtistCard from '../components/ArtistCard';
import MusicCard from '../components/MusicCard';
import ExclusivePromoCard from '../components/ExclusivePromoCard';
import LockedContentCard from '../components/LockedContentCard';
import VideoCard from '../components/VideoCard';
import BenefitCard from '../components/BenefitCard';
import BottomNavigation from '../components/BottomNavigation';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';

import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

import { trendingArtists, popularTracks, lockedContent, latestVideos, benefits } from '../data/guestHome.mock';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GuestHome'>;

export default function GuestHomeScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleGuestAction = () => {
    navigation.navigate('Login');
  };

  const handleHomePress = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background, '#0A0A10', colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header (outside ScrollView) */}
        <AppHeader onAction={handleGuestAction} />

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Carousel */}
            <HeroCarousel onAction={handleGuestAction} />

            {/* Trending Artists */}
            <SectionHeader title="Trending Artists" onAction={handleGuestAction} />
            <FlatList
              data={trendingArtists}
              renderItem={({ item }) => <ArtistCard artist={item} onAction={handleGuestAction} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />

            {/* Popular This Week */}
            <SectionHeader title="Popular This Week" onAction={handleGuestAction} />
            <FlatList
              data={popularTracks}
              renderItem={({ item }) => <MusicCard track={item} onAction={handleGuestAction} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />

            {/* Exclusive Early Access */}
            <SectionHeader title="Exclusive Early Access" onAction={handleGuestAction} />
            <ExclusivePromoCard onAction={handleGuestAction} />

            <FlatList
              data={lockedContent}
              renderItem={({ item }) => <LockedContentCard content={item} onAction={handleGuestAction} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />

            {/* Latest Music Videos */}
            <SectionHeader title="Latest Music Videos" onAction={handleGuestAction} />
            <FlatList
              data={latestVideos}
              renderItem={({ item }) => <VideoCard video={item} onAction={handleGuestAction} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />

            {/* Why Join MusicWave */}
            <Text style={styles.benefitsTitle}>Why Join MusicWave?</Text>
            <View style={styles.benefitsGrid}>
              {benefits.map((item) => (
                <BenefitCard
                  key={item.id}
                  benefit={item}
                  onAction={handleGuestAction}
                />
              ))}
            </View>

            {/* Final CTA Banner */}
            <View style={styles.finalCtaContainer}>
              <LinearGradient
                colors={colors.darkGlassGradient}
                style={styles.finalCtaInner}
              >
                <View style={styles.finalCtaTopRow}>
                  <View style={styles.ctaIconContainer}>
                    <Headphones color={colors.primary} size={30} />
                  </View>
                  <Text style={styles.finalCtaTitle}>Your music journey starts here.</Text>
                </View>

                <View style={styles.finalCtaBottomRow}>
                  <PrimaryButton
                    title="Create Account"
                    onPress={handleGuestAction}
                    style={styles.ctaBtnPrimary}
                  />
                  <SecondaryButton
                    title="Sign In"
                    onPress={handleGuestAction}
                    style={styles.ctaBtnSecondary}
                  />
                  <View style={styles.ctaAlreadyAccountCol}>
                    <Text style={styles.alreadyAccountText}>Already have</Text>
                    <Text style={styles.alreadyAccountText}>an account?</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Spacer for bottom tab bar */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Animated.View>

        {/* Fixed bottom navigation */}
        <BottomNavigation onAction={handleGuestAction} onHomePress={handleHomePress} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  horizontalList: {
    paddingLeft: spacing.horizontalPadding,
    paddingRight: spacing.horizontalPadding - spacing.cardGap,
    marginBottom: spacing.sectionSpacing,
  },
  benefitsTitle: {
    color: colors.textPrimary,
    fontSize: typography.sectionHeading,
    fontWeight: typography.weightBold,
    marginHorizontal: spacing.horizontalPadding,
    marginTop: spacing.sectionSpacing,
    marginBottom: spacing.md,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.horizontalPadding - spacing.xs,
    marginBottom: spacing.sectionSpacing,
  },
  finalCtaContainer: {
    marginHorizontal: spacing.horizontalPadding,
    marginTop: spacing.md,
    marginBottom: spacing.sectionSpacing,
  },
  finalCtaInner: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderThin,
  },
  finalCtaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ctaIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.15)',
  },
  finalCtaTitle: {
    color: colors.textPrimary,
    fontSize: typography.sectionHeading - 2,
    fontWeight: typography.weightBold,
    flex: 1,
  },
  finalCtaBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  ctaBtnPrimary: {
    flex: 1.2,
  },
  ctaBtnSecondary: {
    flex: 1,
  },
  ctaAlreadyAccountCol: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  alreadyAccountText: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 11,
  },
  bottomSpacer: {
    height: 20,
  },
});
