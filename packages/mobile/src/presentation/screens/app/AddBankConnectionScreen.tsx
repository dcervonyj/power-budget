import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function AddBankConnectionScreen() {
  return (
    <View style={styles.container}>
      <Text>AddBankConnection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
