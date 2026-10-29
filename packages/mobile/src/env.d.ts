declare namespace NodeJS {
  interface ProcessEnv {
    /** Inlined by Expo at bundle time; only the literal `process.env.EXPO_PUBLIC_*` form works. */
    readonly EXPO_PUBLIC_API_URL?: string;
    /** Sentry DSN of the `mobile` project, set per EAS profile in eas.json. */
    readonly EXPO_PUBLIC_SENTRY_DSN?: string;
  }
}
