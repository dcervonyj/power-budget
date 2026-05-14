import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function PlansListScreen() {
  return (
    <View style={styles.container}>
      <Text>Plans</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
