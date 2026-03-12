
import React from 'react';
import { Image, StyleSheet, View, Dimensions } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import { LinearGradient } from 'expo-linear-gradient'; // Ensure this is installed
import { Colors } from '../theme';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      {/* Cinematic Background Gradient */}
      <LinearGradient
        colors={Colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Logo with High-End Glow */}
      <Shadow 
        distance={40} 
        startColor="rgba(255, 69, 0, 0.25)" // Orange glow like the image
        offset={[0, 0]}
      >
        <View style={styles.logoWrapper}>
           <Image
            source={require('../image.png')}
            style={styles.logo}
            resizeMode="cover"
          />
          {/* Internal gradient for the "Glassy" feel */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)']}
            style={styles.innerGradient}
          />
        </View>
      </Shadow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 30, // Rounded corners like the music icon
    overflow: 'hidden',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  innerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
});
