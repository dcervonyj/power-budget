/** Metro's `require.context` (enabled by Expo), which @types/node does not know. */
interface NodeRequire {
  context(
    directory: string,
    includeSubdirectories: boolean,
    filter: RegExp,
  ): {
    keys(): string[];
    (id: string): Record<string, unknown>;
  };
}

declare namespace NodeJS {
  interface ProcessEnv {
    /** `1` builds the component gallery instead of the app (DSN-031). */
    readonly EXPO_PUBLIC_GALLERY?: string;
  }
}

/** Web only (guarded by `Platform.OS === 'web'`); the mobile tsconfig has no DOM lib. */
declare const document: {
  readonly documentElement: { setAttribute(name: string, value: string): void };
};
