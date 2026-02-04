import { initFlagd } from './flagd';
import { initGrowthBook } from './growthbook';
import { initFlagsmith } from './flagsmith';

export const PROVIDERS = {
  flagd: {
    id: 'flagd',
    label: 'flagd (local file via flagd)',
    init: initFlagd,
  },
  growthbook: {
    id: 'growthbook',
    label: 'GrowthBook (offline JSON)',
    init: initGrowthBook,
  },
  flagsmith: {
    id: 'flagsmith',
    label: 'Flagsmith (bootstrap/offline)',
    init: initFlagsmith,
  },
};

export const DEFAULT_PROVIDER = 'flagd';
export const PROVIDER_STORAGE_KEY = 'providerChoice';