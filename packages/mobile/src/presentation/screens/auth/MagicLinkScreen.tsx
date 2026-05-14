import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function MagicLinkScreen() {
  return (
    <View style={styles.container}>
      <Text>MagicLink</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
