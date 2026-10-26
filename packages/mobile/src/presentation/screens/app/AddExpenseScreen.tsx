import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormattedMessage } from 'react-intl';

/** Placeholder: the real screen replaces this file. */
export function AddExpenseScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>
        <FormattedMessage id="shell.tab.add" defaultMessage="Add expense" />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
