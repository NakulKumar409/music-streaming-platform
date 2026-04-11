# Quick Test Guide - Background Playback

## 🚀 Ready to Test? Follow These Steps

### Step 1: Build & Install

```bash
cd /Users/mdmainuddin/Desktop/music-streaming-platform/mobile

# Clean previous builds
rm -rf node_modules/.cache

# Install dependencies
npm install

# Build for Android
npx expo prebuild --platform android
npx expo run:android --device

# OR Build for iOS
npx expo prebuild --platform ios
cd ios && pod install && cd ..
npx expo run:ios --device
```

### Step 2: Open Test Screen

1. Launch app on real device
2. Login
3. Navigate to **BackgroundPlaybackTest** screen:
   - Add temporary button somewhere:
   ```typescript
   <Button 
     title="🧪 Test Background" 
     onPress={() => navigation.navigate('BackgroundPlaybackTest')} 
   />
   ```

### Step 3: Start Log Capture

**Terminal 1 - Keep running:**
```bash
# Android
adb logcat -c
adb logcat | grep -E "TrackPlayer|PlaybackService|MediaPlayer|RemoteControl" | tee background_test.log

# iOS (new terminal window)
xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "TrackPlayer"' 2>&1 | tee background_test.log
```

### Step 4: Run Tests

| Test | Action | Expected | Log Check |
|------|--------|----------|-----------|
| **Background** | Tap Play → Press Home | Audio continues | `App state: background` + still playing |
| **Screen Off** | Playing → Power button | Audio continues | `App state: inactive` + playing |
| **Lock Screen** | Playing → Lock → Wake | Controls visible | Check lock screen visually |
| **Remote Pause** | Tap pause on lock screen | Audio pauses | `RemotePause triggered` |
| **Remote Play** | Tap play on lock screen | Audio resumes | `RemotePlay triggered` |
| **Notification** | Swipe down (Android) | Media notification | Visual check |
| **Control Center** | Open CC (iOS) | Media controls | Visual check |
| **State Sync** | Remote pause → Unlock | App shows paused | `State synced` |
| **Interruption** | Receive call | Auto-pause/resume | `RemoteDuck` events |

### Step 5: Capture Videos

**iPhone:**
- Settings → Control Center → Add "Screen Recording"
- Swipe down from top-right → Hold record button → Enable microphone
- Record each test scenario

**Android:**
- Swipe down twice → Screen Record
- Enable "Record audio"
- Capture each test

### Step 6: Quick Checklist

```
☐ Background playback: PASS / FAIL
☐ Screen off playback: PASS / FAIL  
☐ Lock screen visible: PASS / FAIL
☐ Lock screen controls work: PASS / FAIL
☐ State sync works: PASS / FAIL
☐ Notification/Control Center: PASS / FAIL
☐ Interruption handling: PASS / FAIL
```

---

## 📱 What You Should See

### Android Notification
```
┌─────────────────────────────┐
│ 🎵 Test Audio Track         │
│ Background Playback Test    │
│ ⏮️ ⏸️ ⏭️ [=========>] 2:34  │
└─────────────────────────────┘
```

### iOS Lock Screen
```
┌─────────────────────────────┐
│         [Time]              │
│                             │
│      [Album Art]            │
│                             │
│   Test Audio Track          │
│   Background Playback Test  │
│                             │
│   ⏮️      ⏸️      ⏭️         │
│                             │
└─────────────────────────────┘
```

---

## 🔍 Quick Log Reference

### Good Signs:
```
[TrackPlayer] PlaybackState changed: 3 isPlaying: true
[MediaPlayer] TrackPlayer setup complete with background capabilities
[PlaybackService] RemotePlay event received
[RemoteControl] REMOTE PLAY triggered from lock screen
[MediaPlayer] State synced: isPlaying = true
```

### Bad Signs:
```
[TrackPlayer] Error: Player not initialized
[PlaybackService] Service not registered
[MediaPlayer] Failed to load track
Audio paused unexpectedly
No notification on Android
```

---

## 📦 Files for Verification

After testing, you should have:

1. **`background_test.log`** - All captured logs
2. **`test_video_1.mp4`** - Lock screen controls
3. **`test_video_2.mp4`** - Notification panel (Android) / Control Center (iOS)
4. **`test_video_3.mp4`** - Background playback proof
5. **`completed_checklist.txt`** - Your test results

---

## ✅ Success = These 5 Things Work

1. ☐ Audio plays when app minimized
2. ☐ Audio plays when screen off
3. ☐ Lock screen shows track info + controls
4. ☐ Lock screen controls actually work
5. ☐ App state syncs with remote controls

**If all 5 pass → System is ready for production**

---

## 🆘 Common Issues

### Issue: Audio stops when minimizing
**Fix:** Check AndroidManifest.xml has foreground service permissions

### Issue: No lock screen controls
**Fix:** Ensure TrackPlayer capabilities configured, artwork URL valid

### Issue: Controls don't sync
**Fix:** Check event listeners registered in MediaPlayerProvider

### Issue: No notification (Android)
**Fix:** Verify MusicService declared in manifest

---

## 📞 Need Help?

Check these files:
- `/mobile/BACKGROUND_PLAYBACK_SETUP.md` - Full implementation docs
- `/mobile/REAL_DEVICE_VERIFICATION.md` - Complete test procedures
- `/mobile/apps/fan/src/screens/BackgroundPlaybackTestScreen.tsx` - Test screen code

---

## 🎯 Final Deliverables

When done testing, provide:

```
1. Test Result: PASS / PARTIAL / FAIL
2. Device: [Model + OS Version]
3. Log file: [attached]
4. Videos: [attached]
5. Issues found: [none / list them]
6. Fixes applied: [none / list them]
```

**This proves the system works on real devices!**
