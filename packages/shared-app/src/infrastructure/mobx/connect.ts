import { observer } from 'mobx-react-lite';
import type { FunctionComponent } from 'react';

// The return type is inferred from mobx-react-lite so it follows the consumer's
// React types (React 18 in web, React 19 in mobile, which compiles this file itself).
export function connect<P extends object>(Component: FunctionComponent<P>) {
  return observer(Component);
}
