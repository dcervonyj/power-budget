import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormattedMessage } from 'react-intl';

export function RegisterScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>
        <FormattedMessage id="screen.register.title" defaultMessage="Register" />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
