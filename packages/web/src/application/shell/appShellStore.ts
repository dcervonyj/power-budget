import { apiClient, householdsApi } from '../../AppProviders.js';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { HttpShellApi } from '../../infrastructure/api/HttpShellApi.js';
import { clientSession } from '../auth/ClientSession.js';
import { ShellStore } from './ShellStore.js';

/** The app shell's store, wired to the API; forgets everything when the session ends. */
export const appShellStore = new ShellStore(new HttpShellApi(apiClient, householdsApi));
clientSession.register(appShellStore);
