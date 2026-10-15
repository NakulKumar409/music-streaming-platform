# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:
# TrackPlayer
-keep class com.doublesymmetry.trackplayer.** { *; }

# Expo Video & AV
-keep class expo.modules.video.** { *; }
-keep class expo.modules.av.** { *; }
-keep class expo.modules.core.** { *; }

# SVG
-keep class com.horcrux.svg.** { *; }

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
