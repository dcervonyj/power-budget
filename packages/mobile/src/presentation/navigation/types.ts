import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// Auth stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  MagicLink: undefined;
  TotpEnrollment: undefined;
  OAuthCallback: { code: string; state?: string };
};

// App tab bar
export type AppTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Plans: undefined;
  Settings: undefined;
};

// App stack (screens reachable from tabs)
export type AppStackParamList = {
  Tabs: undefined;
  TransactionDetail: { transactionId: string };
  PlanEditor: { planId?: string };
  PlanDashboard: { planId: string };
  BankConnections: undefined;
  AddBankConnection: undefined;
  Categories: undefined;
  Household: undefined;
  AuditLog: undefined;
};

// Root navigator
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AppStackScreenProps<T extends keyof AppStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<AppStackParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

export type AppTabScreenProps<T extends keyof AppTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>;
