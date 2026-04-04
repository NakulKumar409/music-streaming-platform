import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function LazyScreen<P extends object>(
  Component: React.LazyExoticComponent<React.ComponentType<P>>
) {
  return (props: P) => (
    <Suspense
      fallback={
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      }
    >
      <Component {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
