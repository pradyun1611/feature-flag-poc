import { OpenFeature } from '@openfeature/web-sdk';
import { PROVIDER_STORAGE_KEY, DEFAULT_PROVIDER, PROVIDERS } from '../providers/registry';

export async function initOpenFeature() {
  const choice = localStorage.getItem(PROVIDER_STORAGE_KEY) || DEFAULT_PROVIDER;
  const entry = PROVIDERS[choice] ?? PROVIDERS[DEFAULT_PROVIDER];

  // Initialize the chosen provider (it will call setProviderAndWait internally)
  await entry.init();

  // Return a client—App.js expects this
  return OpenFeature.getClient('frontend');
}