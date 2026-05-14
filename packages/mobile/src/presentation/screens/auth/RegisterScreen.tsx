import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text>Register</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
