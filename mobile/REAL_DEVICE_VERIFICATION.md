# Real Device Verification Guide

## ⚠️ IMPORTANT: Real Device Testing Required

**Simulator/emulator CANNOT properly test:**
- Lock screen controls
- Notification bar media controls  
- Background audio behavior
- Audio focus/interruptions
- Control Center integration

**You MUST test on physical devices for accurate results.**

---

## Pre-Test Setup

### 1. Build Development App

#### Android:
```bash
cd /Users/mdmainuddin/Desktop/music-streaming-platform/mobile

# Clean build
rm -rf android/app/build

# Prebuild
npx expo prebuild --platform android

# Build debug APK
npx expo run:android

# OR for release testing:
cd android
./gradlew assembleRelease
```

#### iOS:
```bash
cd /Users/mdmainuddin/Desktop/music-streaming-platform/mobile

# Clean build
rm -rf ios/build

# Prebuild
npx expo prebuild --platform ios

# Install pods
cd ios && pod install

# Run on device
npx expo run:ios --device
```

### 2. Connect for Log Capture

#### Android (ADB):
```bash
# Connect device via USB, enable USB debugging
adb devices

# Start log capture
adb logcat -c  # Clear previous logs
adb logcat | grep -E "TrackPlayer|PlaybackService|MediaPlayer|RemoteControl|AudioFocus" > trackplayer_logs.txt
```

#### iOS (Console.app or Xcode):
```bash
# Using xcrun for device logs
xcrun devicectl device list  # Get device ID
xcrun devicectl device log stream --device <DEVICE_ID>

# Or use Console.app on Mac with device connected
```

---

## Test Screen Navigation

The app now includes a **Background Playback Test Screen** for easy verification:

1. Login to the app
2. Navigate to: `BackgroundPlaybackTest` screen
   - You can add a temporary button in any screen:
   ```typescript
   import { useNavigation } from '@react-navigation/native';
   
   // In your component:
   const navigation = useNavigation();
   
   // Add button:
   <Button title="Test Background Playback" 
           onPress={() => navigation.navigate('BackgroundPlaybackTest')} />
   ```

---

## Verification Test Cases

### ✅ TEST 1: Background Playback

**Steps:**
1. Open app on real device
2. Navigate to BackgroundPlaybackTest screen
3. Tap "Load Test Track"
4. Tap Play button
5. Confirm audio is playing
6. Press HOME button to minimize app

**Expected Results:**
- [ ] Audio continues playing without interruption
- [ ] No silence or pause when minimizing
- [ ] Notification appears (Android)

**Log Verification:**
```
[TrackPlayer] PlaybackState changed: 3 isPlaying: true
[AppState] App state changed to: background
[PlaybackService] Background playback continuing...
```

---

### ✅ TEST 2: Screen Off Playback

**Steps:**
1. Play audio track
2. Press POWER button to turn off screen
3. Wait 5-10 seconds

**Expected Results:**
- [ ] Audio continues playing
- [ ] No stutter or pause
- [ ] Device goes to sleep but audio persists

**Log Verification:**
```
[AppState] App state changed to: inactive
[AppState] App state changed to: background
[TrackPlayer] PlaybackState: 3 (still playing)
```

---

### ✅ TEST 3: Lock Screen Controls (CRITICAL)

**Steps:**
1. Play audio track
2. Press POWER button to lock screen
3. Press POWER again (don't unlock, just wake screen)
4. Look for media controls

**Expected Results - MUST SEE:**
- [ ] Track title displayed
- [ ] Artist name displayed  
- [ ] Album artwork displayed (or placeholder)
- [ ] Play/Pause button visible
- [ ] Next/Previous buttons visible
- [ ] Progress bar/scrubber visible

**Controls Test:**
- [ ] Tap PAUSE on lock screen → Audio pauses
- [ ] Tap PLAY on lock screen → Audio resumes
- [ ] Check app UI updates when unlocking

**Log Verification:**
```
[RemoteControl] REMOTE PAUSE triggered from lock screen
[MediaPlayer] RemotePause event received
[MediaPlayer] PlaybackState changed: 2 isPlaying: false
```

**📹 VIDEO REQUIRED:** Record lock screen showing controls working

---

### ✅ TEST 4: Notification Panel Controls (Android Only)

**Steps:**
1. Play audio track
2. Swipe down from top to open notification panel
3. Look for media notification

**Expected Results:**
- [ ] Persistent notification visible
- [ ] Track title and artist in notification
- [ ] Play/Pause button in notification
- [ ] Next/Previous buttons
- [ ] Progress bar in expanded view

**Controls Test:**
- [ ] Tap PAUSE in notification → Audio pauses
- [ ] Tap PLAY in notification → Audio resumes
- [ ] Swipe away notification → Define expected behavior

**Log Verification:**
```
[PlaybackService] RemotePause event received
[PlaybackService] Playback paused from remote
[PlaybackService] RemotePlay event received
[PlaybackService] Playback started from remote
```

**📹 VIDEO REQUIRED:** Record notification panel showing controls

---

### ✅ TEST 5: iOS Control Center

**Steps:**
1. Play audio track on iOS device
2. Open Control Center:
   - iPhone X+: Swipe down from top-right
   - Older iPhone: Swipe up from bottom

**Expected Results:**
- [ ] Media controls visible in Control Center
- [ ] Track info displayed
- [ ] Play/Pause button works
- [ ] Next/Previous buttons work

**Log Verification:**
```
[RemoteControl] REMOTE PLAY triggered from Control Center
[PlaybackService] RemotePlay event received
```

**📹 VIDEO REQUIRED:** Record Control Center showing media controls

---

### ✅ TEST 6: State Synchronization

**Steps:**
1. Play audio in app
2. Lock device
3. Pause from lock screen
4. Unlock device
5. Check app UI

**Expected Results:**
- [ ] App shows PAUSED state immediately
- [ ] Play button visible (not pause)
- [ ] Progress bar stopped at correct position

**Reverse Test:**
1. Pause in app
2. Lock device
3. Play from lock screen
4. Unlock device
5. [ ] App shows PLAYING state

**Log Verification:**
```
[MediaPlayer] RemotePause event received
[MediaPlayer] PlaybackState changed: 2 isPlaying: false
[MediaPlayer] State synced: isPlaying = false
```

---

### ✅ TEST 7: Audio Interruptions

**Test A - Phone Call:**
1. Play audio
2. Receive phone call
3. [ ] Audio auto-pauses
4. End call
5. [ ] Audio auto-resumes

**Test B - Voice Assistant:**
1. Play audio
2. Trigger Siri (iOS) or Google Assistant (Android)
3. [ ] Audio pauses during voice input
4. Dismiss assistant
5. [ ] Audio resumes

**Test C - Another Audio App:**
1. Play audio in your app
2. Open Spotify/YouTube Music
3. Play audio in other app
4. [ ] Your app audio pauses (audio focus lost)
5. Pause other app
6. [ ] Your app can resume

**Log Verification:**
```
[PlaybackService] RemoteDuck event: {permanent: true}
[AudioFocus] Paused due to permanent duck (phone call)
[PlaybackService] RemoteDuck event: {permanent: false, paused: false}
[AudioFocus] Resumed after temporary duck
```

---

### ✅ TEST 8: Progress Bar Scrubbing

**Steps:**
1. Play long audio track (>2 minutes)
2. Lock device
3. Wake screen (show lock screen)
4. Scrub progress bar to middle

**Expected Results:**
- [ ] Audio jumps to new position
- [ ] Progress bar updates
- [ ] Audio continues from new position

**Log Verification:**
```
[PlaybackService] RemoteSeek event received: 120.5
[MediaPlayer] RemoteSeek event received: 120.5
[TrackPlayer] Seeked to position: 120.5
```

---

### ✅ TEST 9: Force Kill Behavior

**Steps:**
1. Play audio
2. Open recent apps
3. Swipe away/kill the app

**Expected Behavior:**
Define your expected behavior:

**Option A - Stop Playback:**
- [ ] Audio stops immediately
- [ ] Notification disappears
- [ ] No orphaned service running

**Option B - Continue Playback:**
- [ ] Audio continues via foreground service
- [ ] Notification persists
- [ ] Can control from notification

**Log Verification:**
```
# If stopping:
[PlaybackService] Playback stopped and reset
[TrackPlayer] Service destroyed

# If continuing:
[PlaybackService] Service continuing in background
[TrackPlayer] Playing track in background
```

---

### ✅ TEST 10: Long Duration Background

**Steps:**
1. Play audio
2. Minimize app
3. Lock screen
4. Wait 5+ minutes
5. Check audio still playing

**Expected Results:**
- [ ] Audio continues after 5 minutes
- [ ] No system killed the service
- [ ] Notification still visible (Android)
- [ ] Controls still work

---

## Log Capture Template

Create a file with captured logs for each test:

```bash
# Android - Run this during each test
adb logcat -d | grep -E "TrackPlayer|PlaybackService|MediaPlayer|RemoteControl|AudioFocus|AppState" > test_results.txt

# iOS - Use Console.app filter:
# Search: TrackPlayer OR PlaybackService OR MediaPlayer OR Remote
```

---

## Success Criteria

### Must Pass (Critical):
- ✅ Background playback works (minimize app)
- ✅ Screen off playback works
- ✅ Lock screen controls visible
- ✅ Lock screen controls functional
- ✅ State sync works (remote → app)

### Should Pass (Important):
- ✅ Notification panel controls (Android)
- ✅ Control Center controls (iOS)
- ✅ Audio interruption handling
- ✅ Progress bar scrubbing works

### Nice to Have:
- ✅ Force kill behavior defined
- ✅ Long duration stability
- ✅ Artwork display on lock screen

---

## Issue Reporting Template

If tests fail, document with:

```markdown
## Test Failed: [Test Name]

### Device Info:
- Device: [Model]
- OS Version: [Android X / iOS X]
- App Version: [Build]

### Steps to Reproduce:
1. [Step 1]
2. [Step 2]

### Expected:
[What should happen]

### Actual:
[What actually happens]

### Logs:
```
[Paste relevant log lines]
```

### Screenshots/Videos:
[Attach media]
```

---

## Quick Verification Checklist

Print this and check off during testing:

```
☐ Build app on real device
☐ Open BackgroundPlaybackTest screen
☐ Load and play test track

--- Background Tests ---
☐ Minimize app - audio continues
☐ Screen off - audio continues
☐ 5+ min background - audio continues

--- Lock Screen Tests ---
☐ Track title visible on lock screen
☐ Artist name visible on lock screen
☐ Artwork visible on lock screen
☐ Play/Pause button works on lock screen
☐ Next/Previous buttons work on lock screen
☐ Progress bar/scrubbing works on lock screen

--- Android Notification Tests ---
☐ Notification appears when playing
☐ Notification shows track info
☐ Play/Pause works from notification
☐ Next/Previous works from notification

--- iOS Control Center Tests ---
☐ Control Center shows media controls
☐ Track info visible in Control Center
☐ Controls work from Control Center

--- State Sync Tests ---
☐ Pause from lock screen updates app
☐ Play from lock screen updates app
☐ Seek from lock screen updates app

--- Interruption Tests ---
☐ Phone call pauses audio
☐ Audio resumes after call ends
☐ Other audio app takes focus correctly

--- Final ---
☐ All tests documented with logs
☐ Videos recorded of lock/notification controls
☐ Issues logged with device info
```

---

## Verification Complete

When all tests pass, you can confirm:

> ✅ Background Media Playback System is **FULLY OPERATIONAL**
> ✅ Meets Spotify/YouTube Music standards
> ✅ Production-ready for release

**Submit verification package:**
1. ✅ Test logs from all scenarios
2. ✅ Videos of lock screen controls
3. ✅ Videos of notification controls (Android)
4. ✅ Videos of Control Center (iOS)
5. ✅ Completed checklist
6. ✅ Any issues found + fixes applied
