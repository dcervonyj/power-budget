/** Where RequireAuth was going (`state.from`), to return there after login. */
export function returnPath(state: unknown, fallback = '/dashboard'): string {
  const from = read(state, 'from');
  const pathname = read(from, 'pathname');
  const search = read(from, 'search');
  // Only an in-app path: "//host" would leave the app.
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return fallback;
  }

  return typeof search === 'string' ? `${pathname}${search}` : pathname;
}

function read(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return undefined;
  }

  return Reflect.get(value, key);
}
