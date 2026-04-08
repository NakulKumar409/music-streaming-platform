import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  Image,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useAuth } from '../store/authStore';
import { CreditCard, HelpCircle, Library, LogOut, User, Camera, Crown, ArrowDown, ShieldCheck, Lock } from 'lucide-react-native';
import { SubscriptionStatusCard } from '../ui/SubscriptionUI';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

import { userService, type AudioQualityPref, type SubscriptionPlanSummary, type Transaction } from '../services/userService';
import { JWT_STORAGE_KEY, API_BASE_URL } from '../services/api';
import { resetToLogin } from '../navigation/rootNavigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme';
import { ARTIST_WEB_URL } from '../config/env';
import { registerForPushNotifications, disablePushNotifications } from '../services/notificationService';

function PremiumBadge() {
  return (
    <View style={styles.premiumBadge}>
      <Text style={styles.premiumBadgeText}>Premium Member</Text>
    </View>
  );
}

export default function AccountScreen() {
  const { user, userAccountStatus, logout } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const scrollContentPaddingBottom = React.useMemo(() => {
    return Math.max(insets.bottom, 0) + 110;
  }, [insets.bottom]);

  const performLogout = React.useCallback(async () => {
    console.log('DEBUG: Logout initiated');

    try {
      console.log('DEBUG: Attempting to clear AsyncStorage...');
      await AsyncStorage.multiRemove(['userToken', 'userInfo']);
      await AsyncStorage.multiRemove([JWT_STORAGE_KEY, 'sessionUser']);
      console.log('DEBUG: AsyncStorage cleared successfully');

      await logout();
      console.log('DEBUG: Global state updated, triggering redirect...');

      resetToLogin();

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
      console.log('DEBUG: Navigation reset command sent');
    } catch (error: any) {
      console.error('DEBUG_ERROR: Logout failed during execution:', error);
      Alert.alert('Logout Error', 'Logout Error: ' + (error?.message ?? String(error)));
    }
  }, [logout, navigation]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [profileName, setProfileName] = React.useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = React.useState<string>('');
  const [isPremium, setIsPremium] = React.useState(false);
  const [subscriptionCount, setSubscriptionCount] = React.useState(0);
  const [planSummary, setPlanSummary] = React.useState<SubscriptionPlanSummary | null>(null);
  const [artistSubs, setArtistSubs] = React.useState<any[]>([]);
  const [platformPlan, setPlatformPlan] = React.useState<any | null>(null);


  const [listenTime, setListenTime] = React.useState<string>('');
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);

  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [audioQuality, setAudioQuality] = React.useState<AudioQualityPref>('HIGH');

  const [showTransactions, setShowTransactions] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, t, l, plan, fullStatus] = await Promise.all([
        userService.getUserProfile(),
        userService.getTransactions(),
        userService.getListenTime(),
        userService.getSubscriptionPlanSummary(),
        userService.getFullSubscriptionStatus(),
      ]);

      setProfileName(p.name);
      setProfileImageUrl(p.profileImageUrl || '');
      setIsPremium(p.isPremium);
      setSubscriptionCount(p.subscriptionCount);
      setTransactions(t);
      setListenTime(l.formattedTime);
      setPlanSummary(plan);
      
      if (fullStatus) {
        setPlatformPlan(fullStatus.platform);
        setArtistSubs(fullStatus.artists || []);
      }

    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  const planStatusText = React.useMemo(() => {
    const raw = (planSummary?.status ?? '').toString().toUpperCase();
    if (raw === 'ACTIVE') return 'Active';
    if (!raw) return '—';
    return raw;
  }, [planSummary?.status]);

  const planEndDateText = React.useMemo(() => {
    const raw = planSummary?.endDate;
    if (!raw) return '—';
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }, [planSummary?.endDate]);

  const handleRenewArtist = React.useCallback(() => {
    const plan = planSummary?.artistPlan;
    navigation.navigate('SubscriptionFlow', {
      artistId: plan?.artistId ?? '',
      artistName: plan?.artistName ?? 'Artist',
      defaultPlan: 'ARTIST',
    });
  }, [planSummary, navigation]);

  const handleRenewPlatform = React.useCallback(() => {
    navigation.navigate('SubscriptionFlow', { defaultPlan: 'PLATFORM' });
  }, [navigation]);

  const handleUpgrade = React.useCallback(() => {
    navigation.navigate('SubscriptionFlow', {});
  }, [navigation]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refresh();
    });
    return unsubscribe;
  }, [navigation, refresh]);

  const handleLogout = () => {
    console.log('LOGOUT_CLICKED');

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('Are you sure you want to log out?')
          : true;
      if (confirmed) {
        void performLogout();
      }
      return;
    }

    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            void performLogout();
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    return userAccountStatus === 'ACTIVE' ? '#10B981' : '#DC2626';
  };

  const getStatusText = () => {
    return userAccountStatus === 'ACTIVE' ? 'Active' : 'Suspended';
  };

  const handleToggleNotifications = async (next: boolean) => {
    // Optimistically update the UI immediately
    setPushNotifications(next);
    try {
      if (next) {
        // Enable: request OS permission, fetch token, sync to backend
        const result = await registerForPushNotifications();
        if (!result.success) {
          // Revert if permission denied
          setPushNotifications(false);
          if (result.status === 'denied') {
            Alert.alert(
              'Notifications Blocked',
              'Please enable notifications for this app in your iPhone Settings → Music Streaming Platform → Notifications.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
          }
        }
      } else {
        // Disable: tell backend to clear the preference
        await disablePushNotifications();
      }
    } catch (err) {
      console.error('[AccountScreen] Notification toggle error:', err);
      // Revert UI on unexpected error
      setPushNotifications((v) => !v);
    }
  };

  const handleOpenArtistDashboard = () => {
    if (user?.role === 'ARTIST') {
      Linking.openURL(ARTIST_WEB_URL + '/artist/dashboard').catch((err) =>
        console.error('An error occurred', err)
      );
    } else {
      navigation.navigate('ArtistOnboarding');
    }
  };

  const handleSelectQuality = async (next: AudioQualityPref) => {
    setAudioQuality(next);
    try {
      await userService.updateSettings({ audioQuality: next });
    } catch {
      // ignore
    }
  };

  const handleOpenEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleChangeProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      try {
        setIsLoading(true);
        const newImageUrl = await userService.uploadProfileImage(
          asset.uri,
          asset.mimeType || 'image/jpeg',
          asset.fileName || 'profile.jpg'
        );
        setProfileImageUrl(newImageUrl);
      } catch (error: any) {
        Alert.alert('Error', 'Failed to upload profile image. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDownloadInvoice = async (transactionId: string) => {
    try {
      Alert.alert('Download', 'Preparing your invoice...');
      
      const fileUri = `${FileSystem.documentDirectory}invoice_${transactionId}.pdf`;
      const downloadUrl = `${API_BASE_URL}/subscriptions/invoice/${transactionId}`;
      
      const downloadRes = await FileSystem.downloadAsync(
        downloadUrl,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${await AsyncStorage.getItem(JWT_STORAGE_KEY) || await AsyncStorage.getItem('userToken')}`
          }
        }
      );

      if (downloadRes.status === 200) {
        Alert.alert('Downloaded', 'Invoice saved to device: ' + fileUri);
      } else {
        throw new Error('Download failed with status ' + downloadRes.status);
      }
    } catch (error: any) {
      console.error('[AccountScreen] Invoice download error:', error);
      Alert.alert('Error', 'Failed to download invoice. Please try again later.');
    }
  };

  return (
    <LinearGradient
      colors={Colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollContentPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4AA3FF"
              colors={['#4AA3FF']}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Account</Text>
            <Text style={styles.sub}>Manage your profile and settings.</Text>
          </View>

        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.profileAvatarRow}>
              <TouchableOpacity onPress={handleChangeProfileImage} disabled={isLoading}>
                {profileImageUrl ? (
                  <Image source={{ uri: profileImageUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <User size={40} color="#fff" />
                  </View>
                )}
                <View style={styles.cameraIconOverlay}>
                  <Camera size={18} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.profileTitleRow}>
              <Text style={styles.profileName}>{profileName || user?.name?.toString?.() || (user as any)?.fullName || (user as any)?.full_name || 'User'}</Text>
              {!isLoading && isPremium ? <PremiumBadge /> : null}
            </View>
            <Text style={styles.profileEmail}>{user?.email || 'Not available'}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{subscriptionCount}</Text>
                <Text style={styles.statLabel}>Subscribed Artists</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{listenTime || '—'}</Text>
                <Text style={styles.statLabel}>Monthly Listening</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleOpenEditProfile} disabled={isLoading}>
              <Text style={styles.primaryButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Subscriptions</Text>

          {/* Platform Plan card */}
          {platformPlan ? (
            <SubscriptionStatusCard
              plan={platformPlan}
              onRenew={handleRenewPlatform}
            />
          ) : null}

          {/* Artist Plans list */}
          {artistSubs.length > 0 ? (
            <View style={{ marginTop: platformPlan ? 16 : 0 }}>
              {artistSubs.map((sub, idx) => (
                <View key={sub.artistId || idx} style={{ marginBottom: 12 }}>
                  <SubscriptionStatusCard
                    plan={sub}
                    onRenew={() => {
                      navigation.navigate('SubscriptionFlow', {
                        artistId: sub.artistId,
                        artistName: sub.artistName,
                        defaultPlan: 'ARTIST',
                      });
                    }}
                    onManage={() =>
                      navigation.navigate('SubscriptionDetail', {
                        artistId: sub.artistId,
                      })
                    }
                  />
                </View>
              ))}
            </View>
          ) : null}

          {/* No subscriptions → show upgrade CTA */}
          {!platformPlan && artistSubs.length === 0 && !isLoading && (
            <TouchableOpacity
              style={styles.upgradeCta}
              onPress={handleUpgrade}
            >
              <Crown size={20} color="#4AA3FF" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.upgradeCtaTitle}>No Active Plan</Text>
                <Text style={styles.upgradeCtaSub}>Subscribe for HD streaming &amp; exclusive content</Text>
              </View>
              <Text style={styles.upgradeCtaArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* Add Platform Plan nudge if only artist plans active */}
          {artistSubs.length > 0 && !platformPlan && (
            <TouchableOpacity style={styles.nudgeCard} onPress={handleRenewPlatform}>
              <Crown size={16} color="#4AA3FF" />
              <Text style={styles.nudgeText}>
                Upgrade to <Text style={{ color: '#4AA3FF', fontWeight: '900' }}>Platform Plan</Text> for HD streaming
              </Text>
              <Text style={styles.nudgeArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Account Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusLeft}>
              <User size={20} color="#fff" />
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Account Status</Text>
                <Text style={[styles.statusValue, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>
            </View>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleOpenArtistDashboard}
          >
            <User size={20} color="#fff" />
            <Text style={styles.menuText}>{user?.role === 'ARTIST' ? 'Artist Dashboard' : 'Become an Artist'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyLibrary')}
          >
            <Library size={20} color="#fff" />
            <Text style={styles.menuText}>My Library</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowTransactions(true)}>
            <CreditCard size={20} color="#fff" />
            <Text style={styles.menuText}>Subscription & Billing</Text>
          </TouchableOpacity>

          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Push Notifications</Text>
            <Switch value={pushNotifications} onValueChange={handleToggleNotifications} />
          </View>


          <TouchableOpacity style={styles.menuItem}>
            <HelpCircle size={20} color="#fff" />
            <Text style={styles.menuText}>Help & Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <LogOut size={20} color={Colors.accent} />
            <Text style={[styles.menuText, { color: Colors.accent }]}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>Email</Text>
              <Text style={styles.userInfoValue}>{user.email || 'Not available'}</Text>
              <Text style={styles.userInfoLabel}>Name</Text>
              <Text style={styles.userInfoValue}>{profileName || user.name || (user as any).fullName || (user as any).full_name || 'Not set'}</Text>
            </View>
          </View>
        )}
        </ScrollView>

      <Modal visible={showTransactions} animationType="slide" onRequestClose={() => setShowTransactions(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Transaction History</Text>
            <TouchableOpacity onPress={() => setShowTransactions(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txArtist}>{tx.artistName || 'Platform Plan'}</Text>
                  <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.txRight, { flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ alignItems: 'flex-end', marginRight: 16 }}>
                    <Text style={styles.txAmount}>₹{(tx.amount / 100).toFixed(2)}</Text>
                    <Text style={[styles.txStatus, { color: tx.status === 'CAPTURED' || tx.status === 'SUCCESS' ? '#10B981' : '#FFA500' }]}>
                      {tx.status ?? 'PENDING'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.downloadIcon} 
                    onPress={() => handleDownloadInvoice(tx.id)}
                  >
                    <ArrowDown size={20} color={Colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {transactions.length === 0 ? (
              <View style={styles.modalEmptyWrap}>
                <CreditCard size={48} color="rgba(255,255,255,0.15)" />
                <Text style={styles.modalEmptyText}>No transactions found.</Text>
                <Text style={styles.modalEmptySub}>Your billing history will appear here once you subscribe to an artist or platform plan.</Text>
              </View>
            ) : null}

            {transactions.length > 0 && (
              <View style={styles.trustFooter}>
                <View style={styles.trustItem}>
                  <ShieldCheck size={16} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.trustText}>Razorpay Secure</Text>
                </View>
                <View style={styles.trustItem}>
                  <Lock size={16} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.trustText}>SSL Encrypted</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  sub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginLeft: 4,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  statusValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuContent: {
    marginLeft: 12,
    flex: 1,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuSubText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  userInfo: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
  },
  userInfoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },
  userInfoValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  profileAvatarRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  profileAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0B0B',
  },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileEmail: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  premiumBadge: {
    backgroundColor: 'rgba(255,181,8,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,8,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  premiumBadgeText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonSmall: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
  },
  upgradeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,163,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(74,163,255,0.22)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  upgradeCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  upgradeCtaSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  upgradeCtaArrow: { color: '#4AA3FF', fontSize: 18, fontWeight: '900' },
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,163,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(74,163,255,0.18)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  nudgeText: { flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  nudgeArrow: { color: '#4AA3FF', fontSize: 16, fontWeight: '900' },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  prefLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qualityCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  qualityTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  qualityPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  qualityPillActive: {
    borderColor: 'rgba(255,106,0,0.6)',
    backgroundColor: 'rgba(255,106,0,0.12)',
  },
  qualityPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  qualityPillSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  modalScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  modalEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  modalEmptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  modalEmptySub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  txLeft: {
    flex: 1,
  },
  txArtist: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  txDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    color: '#4AA3FF',
    fontSize: 16,
    fontWeight: '900',
  },
  txStatus: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  downloadIcon: {
    padding: 8,
    backgroundColor: 'rgba(255,106,0,0.1)',
    borderRadius: 8,
  },
  trustFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 24,
    marginBottom: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 20,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  editModalCard: {
    width: '100%',
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 16,
  },
  editTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
