import { observer } from 'mobx-react-lite';
import type { FunctionComponent } from 'react';

export function connect<P extends object>(Component: FunctionComponent<P>): FunctionComponent<P> {
  return observer(Component);
}
