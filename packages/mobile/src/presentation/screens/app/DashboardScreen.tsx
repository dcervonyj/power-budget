import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text>Dashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
