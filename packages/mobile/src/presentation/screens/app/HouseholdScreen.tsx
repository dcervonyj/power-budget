import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function HouseholdScreen() {
  return (
    <View style={styles.container}>
      <Text>Household</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
