import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function PlanDashboardScreen() {
  return (
    <View style={styles.container}>
      <Text>PlanDashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
