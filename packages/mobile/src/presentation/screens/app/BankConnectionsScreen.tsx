import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function BankConnectionsScreen() {
  return (
    <View style={styles.container}>
      <Text>BankConnections</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
