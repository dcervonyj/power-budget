import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormattedMessage } from 'react-intl';

export function PlanDashboardScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>
        <FormattedMessage id="screen.planDashboard.title" defaultMessage="Plan Dashboard" />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
