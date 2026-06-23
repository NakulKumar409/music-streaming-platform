import { LinearGradient } from "expo-linear-gradient";
import {
  BadgeCheck,
  Check,
  CreditCard,
  Crown,
  DollarSign,
  ExternalLink,
  Library,
  PlayCircle,
  TrendingUp,
  User,
  Users,
} from "lucide-react-native";
import {
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ARTIST_WEB_URL } from "../config/env";
import { Colors } from "../theme";

const { width } = Dimensions.get("window");

// 1. HERO SECTION
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
    {
      id: 1,
      title: "Upload songs easily",
      icon: <Library size={24} color={Colors.accent} />,
    },
    {
      id: 2,
      title: "Track performance analytics",
      icon: <Crown size={24} color={Colors.accent} />,
    },
    {
      id: 3,
      title: "Earn from subscriptions",
      icon: <CreditCard size={24} color={Colors.accent} />,
    },
    {
      id: 4,
      title: "Reach real listeners",
      icon: <User size={24} color={Colors.accent} />,
    },
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
    { num: "1", title: "Create your account", desc: "Sign up in seconds" },
    {
      num: "2",
      title: "Upload your first song",
      desc: "Share your unreleased tracks",
    },
    { num: "3", title: "Get approved", desc: "Quick platform review" },
    { num: "4", title: "Start growing", desc: "Reach thousands of fans" },
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

// 4. EARNINGS PREVIEW
const EarningsPreview = () => {
  return (
    <View style={styles.earningsCard}>
      <LinearGradient
        colors={["rgba(255,106,0,0.15)", "rgba(255,106,0,0.05)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.earningsGradient}
      />

      <View style={styles.earningsHeader}>
        <View style={styles.earningsHeaderLeft}>
          <DollarSign size={20} color={Colors.accent} />
          <Text style={styles.earningsTitle}>Potential Earnings</Text>
        </View>
        <View style={styles.earningsBadge}>
          <TrendingUp size={14} color="#4CAF50" />
          <Text style={styles.earningsBadgeText}>+250% growth</Text>
        </View>
      </View>

      <View style={styles.earningsMain}>
        <View style={styles.earningsIconContainer}>
          <Users size={28} color={Colors.accent} />
        </View>
        <View style={styles.earningsContent}>
          <Text style={styles.earningsMath}>10 fans @ $10/mo</Text>
          <Text style={styles.earningsTotal}>$100 / month</Text>
          <View style={styles.earningsProgress}>
            <View style={styles.earningsProgressBar}>
              <View style={[styles.earningsProgressFill, { width: "100%" }]} />
            </View>
            <Text style={styles.earningsProgressText}>
              Monthly recurring revenue
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.earningsFooter}>
        <Text style={styles.earningsDesc}>
          🎵 Build a sustainable income from your music
        </Text>
      </View>
    </View>
  );
};

// 5. MOTIVATION SECTION
const MotivationSection = () => {
  return (
    <View style={styles.motivationContainer}>
      <PlayCircle
        size={48}
        color={Colors.accent}
        style={{ marginBottom: 16 }}
      />
      <Text style={styles.motivationTitle}>Start your music journey today</Text>
      <Text style={styles.motivationDesc}>
        Thousands of listeners are waiting for your sound.
      </Text>
    </View>
  );
};

export default function ArtistOnboardingScreen() {
  const insets = useSafeAreaInsets();

  // ✅ SIMPLE FUNCTION - Direct browser open
  const handleStartUploading = () => {
    try {
      const url = ARTIST_WEB_URL?.replace(/\/+$/, "");

      if (!url) {
        Alert.alert("Error", "Artist URL not configured");
        return;
      }

      console.log("🔗 Opening:", url);

      // ✅ Direct open - no async/await issues
      Linking.openURL(url)
        .then(() => console.log("✅ Opened successfully"))
        .catch((err) => {
          console.error("❌ Error:", err);
          Alert.alert("Error", "Failed to open browser");
        });
    } catch (error) {
      console.error("❌ Error:", error);
      Alert.alert("Error", "Something went wrong");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#1a0f0a", "#000000"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={styles.gradientBackground}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20 },
        ]}>
        <HeroSection />
        <BenefitsSection />
        <EarningsPreview />
        <HowItWorksSection />
        <MotivationSection />
      </ScrollView>

      {/* CTA BUTTON */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)", "#000"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleStartUploading}>
          <LinearGradient
            colors={["#ff6a00", "#d85200"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}>
            <ExternalLink size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.ctaText}>Start Uploading Music</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },

  // Hero
  heroContainer: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 20,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  trustBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,106,0,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,106,0,0.2)",
  },
  trustBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Sections
  sectionContainer: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 20,
  },

  // Benefits
  benefitsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  benefitCard: {
    width: (width - 40 - 16) / 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  benefitIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,106,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },

  // Timeline
  timeline: {
    paddingLeft: 10,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
    position: "relative",
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,106,0,0.2)",
    borderWidth: 1,
    borderColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  timelineNodeText: {
    color: Colors.accent,
    fontWeight: "900",
    fontSize: 14,
  },
  timelineLine: {
    position: "absolute",
    left: 15.5,
    top: 32,
    bottom: -24,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    zIndex: 1,
  },
  timelineContent: {
    marginLeft: 16,
    flex: 1,
    justifyContent: "center",
  },
  timelineTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  timelineDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },

  // Earnings
  earningsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255,106,0,0.2)",
    backgroundColor: "rgba(255,255,255,0.03)",
    position: "relative",
    overflow: "hidden",
  },
  earningsGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  earningsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  earningsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  earningsTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  earningsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  earningsBadgeText: {
    color: "#4CAF50",
    fontSize: 11,
    fontWeight: "700",
  },
  earningsMain: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  earningsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,106,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  earningsContent: {
    flex: 1,
  },
  earningsMath: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  earningsTotal: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 8,
  },
  earningsProgress: {
    gap: 4,
  },
  earningsProgressBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  earningsProgressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  earningsProgressText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "500",
  },
  earningsFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
    marginTop: 4,
  },
  earningsDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },

  // Motivation
  motivationContainer: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 20,
  },
  motivationTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  motivationDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
  },

  // CTA
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  ctaButton: {
    width: "100%",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  ctaGradient: {
    height: 60,
    borderRadius: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
