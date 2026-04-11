# Background Media Playback System

Complete implementation of background audio playback with lock screen controls, notification bar player, and system media session integration for both Android and iOS.

## Features Implemented

### 1. Background Playback
- Audio continues playing when app is minimized
- Audio continues when screen is turned off
- Proper foreground service configuration for Android
- Background audio mode enabled for iOS

### 2. Lock Screen Controls
- Track title display
- Artist name display
- Album artwork display
- Play/Pause controls
- Next/Previous controls
- Progress bar scrubbing

### 3. Notification Bar Player (Android)
- Persistent media notification
- Song info display
- Playback controls (Play/Pause/Next/Previous)
- Progress bar
- Expandable notification view

### 4. Control Center (iOS)
- Full iOS Control Center integration
- Current track display
- Playback controls
- Progress tracking

### 5. System Media Session
- Proper media session registration
- Playback state sync with OS
- Audio focus handling
- Interruption management (phone calls, notifications)

## Files Modified/Created

### Configuration Files
1. **`android/app/src/main/AndroidManifest.xml`**
   - Added foreground service permissions
   - Added media playback service declaration

2. **`app.json`**
   - Added Android permissions for foreground service
   - Updated iOS background modes (audio, fetch)
   - Added expo-av plugin configuration

### Code Files
3. **`index.js`**
   - Registers background playback service

4. **`apps/fan/src/services/playbackService.ts`**
   - Complete background event handling
   - Remote control event listeners
   - Audio ducking/interruption handling
   - Error recovery

5. **`apps/fan/src/providers/MediaPlayerProvider.tsx`**
   - Enhanced TrackPlayer setup with capabilities
   - Remote event listeners for state sync
   - Improved track metadata for notifications

6. **`apps/fan/src/utils/backgroundPlayback.ts`** (NEW)
   - Background playback utilities
   - State management helpers
   - Debug and testing functions

## Technical Details

### Android Configuration

#### Permissions Added:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
```

#### Service Declaration:
```xml
<service 
  android:name="com.doublesymmetry.trackplayer.service.MusicService"
  android:enabled="true"
  android:exported="false"
  android:foregroundServiceType="mediaPlayback" />
```

### iOS Configuration

#### Background Modes:
- `audio` - Background audio playback
- `fetch` - Background fetch capabilities

#### Info.plist:
Already configured in `app.json`, applied to `ios/FanApp/Info.plist`:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>fetch</string>
</array>
```

### TrackPlayer Capabilities

Configured capabilities in `MediaPlayerProvider.tsx`:
- `Capability.Play` - Play button
- `Capability.Pause` - Pause button
- `Capability.SkipToNext` - Next track
- `Capability.SkipToPrevious` - Previous track
- `Capability.SeekTo` - Progress bar scrubbing
- `Capability.JumpForward` - Fast forward (10s)
- `Capability.JumpBackward` - Rewind (10s)

### Background Event Handlers

The following events are handled in both `playbackService.ts` and `MediaPlayerProvider.tsx`:

1. **RemotePlay** - Lock screen/notification play button
2. **RemotePause** - Lock screen/notification pause button
3. **RemoteNext** - Next track button
4. **RemotePrevious** - Previous track button
5. **RemoteSeek** - Progress bar scrubbing
6. **RemoteJumpForward** - Fast forward button
7. **RemoteJumpBackward** - Rewind button
8. **RemoteDuck** - Audio interruption handling
9. **PlaybackState** - State change tracking
10. **PlaybackError** - Error handling

## Verification Checklist

### Case 1: Background Playback
1. Play an audio track in the app
2. Press home button to minimize app
3. Audio should continue playing
4. Check notification bar for media controls

### Case 2: Lock Screen Controls
1. Play an audio track
2. Press power button to lock screen
3. Wake screen (don't unlock)
4. Verify track info displayed
5. Test play/pause button
6. Test next/previous buttons

### Case 3: Notification Controls (Android)
1. Play an audio track
2. Swipe down from top to open notification panel
3. Verify media notification with controls
4. Test all buttons (play/pause, next, previous)
5. Verify progress bar updates

### Case 4: Control Center (iOS)
1. Play an audio track
2. Swipe up from bottom (or down from top-right on newer iPhones)
3. Verify media controls in Control Center
4. Test play/pause, next, previous

### Case 5: State Synchronization
1. Play audio from app
2. Pause from lock screen/notification
3. Verify app UI updates to paused state
4. Resume from app
5. Verify lock screen/notification shows playing state

### Case 6: Audio Interruptions
1. Play audio track
2. Receive phone call or trigger Siri
3. Audio should pause automatically
4. End call/dismiss Siri
5. Audio should resume automatically

### Case 7: Progress Bar
1. Play long audio track
2. Scrub progress bar on lock screen
3. Verify audio jumps to new position
4. Verify app UI updates position

## Building and Testing

### Android Build
```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# Or for development:
npx expo run:android
```

### iOS Build
```bash
cd mobile
npx expo prebuild --platform ios
cd ios
pod install
cd ..
npx expo run:ios
```

### Important Notes

1. **Real Device Testing Required**: Background playback and lock screen controls do not work correctly on simulators. Must test on physical devices.

2. **Android 12+ Foreground Service**: On Android 12+, the foreground service notification is mandatory for background audio. The system may delay the notification slightly.

3. **iOS Simulator Limitations**: Control Center and lock screen controls are limited in iOS Simulator. Test on real iOS device for full verification.

4. **Audio URL Requirements**: Ensure audio URLs are properly formatted and accessible. HTTPS URLs with proper CORS headers work best.

5. **Artwork Images**: For best lock screen/notification display, provide artwork URLs that are:
   - Square aspect ratio (1:1)
   - Reasonable size (500x500 to 1000x1000)
   - HTTPS accessible
   - Properly cached

## Troubleshooting

### Android Issues

**Issue**: Notification doesn't appear
- Check `AndroidManifest.xml` permissions
- Verify service declaration is correct
- Check logcat for errors: `adb logcat | grep -i "trackplayer\|media"`

**Issue**: Audio stops when app minimized
- Verify `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission
- Check MusicService declaration in manifest
- Ensure `stopForegroundGracePeriod` is set to 0 in TrackPlayer options

### iOS Issues

**Issue**: No Control Center controls
- Verify `UIBackgroundModes` includes `audio`
- Check that TrackPlayer is properly configured with capabilities
- Test on real device, not simulator

**Issue**: Lock screen doesn't show controls
- Ensure track metadata includes title and artist
- Check artwork URL is valid
- Verify audio session is active

### Common Issues

**Issue**: Play/Pause out of sync between app and controls
- Check that remote event listeners are properly registered
- Verify state synchronization in `MediaPlayerProvider.tsx`
- Check console logs for event handler errors

**Issue**: Audio interruptions not handled
- Verify `autoHandleInterruptions: true` in TrackPlayer setup
- Check RemoteDuck event handler implementation
- Test with phone call or alarm

## Debug Functions

Use the background playback utilities for debugging:

```typescript
import { 
  logPlaybackState, 
  testBackgroundPlayback,
  getPlaybackState 
} from './utils/backgroundPlayback';

// Log current state
await logPlaybackState();

// Test background functionality
await testBackgroundPlayback();

// Get current state programmatically
const state = await getPlaybackState();
console.log(state);
```

## Performance Considerations

1. **Memory**: Background audio uses additional memory for buffering
2. **Battery**: Continuous background playback impacts battery life
3. **Network**: Streaming audio uses data; consider download options
4. **Cleanup**: Always call `TrackPlayer.reset()` when appropriate to free resources

## Security Notes

1. **HTTPS Only**: Use HTTPS URLs for audio and artwork to ensure lock screen/notification display works correctly
2. **Token Expiry**: JWT tokens in streaming URLs may expire; implement refresh logic
3. **User Privacy**: Be aware that lock screen shows track info to anyone who can see the device

## Additional Resources

- [react-native-track-player Documentation](https://rntp.dev/)
- [Android Foreground Services](https://developer.android.com/guide/components/foreground-services)
- [iOS Background Audio](https://developer.apple.com/documentation/avfoundation/media_playback/creating_a_basic_audio_player)
