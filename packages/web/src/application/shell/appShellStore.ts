import { apiClient, householdsApi } from '../../AppProviders.js';
import { HttpShellApi } from '../../infrastructure/api/HttpShellApi.js';
import { clientSession } from '../auth/ClientSession.js';
import { ShellStore } from './ShellStore.js';

/** The app shell's store, wired to the API; forgets everything when the session ends. */
export const appShellStore = new ShellStore(new HttpShellApi(apiClient, householdsApi));
clientSession.register(appShellStore);
