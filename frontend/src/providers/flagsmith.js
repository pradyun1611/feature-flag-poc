// src/providers/flagsmith.js
import { OpenFeature } from '@openfeature/web-sdk';
import flagsmith from 'flagsmith';

/**
 * OpenFeature Provider wrapper for Flagsmith supporting:
 * - Offline local evaluation with segments/rules via /flagsmith/environment.json
 * - Fallback to static bootstrap via /flagsmith/bootstrap.json
 * - Context (userId) propagation via identify + trait, so rules like { property: "userId" } match locally
 */
class FlagsmithOFProvider {
  metadata = { name: 'flagsmith' };

  constructor(options) {
    this.options = options || {};
    this._hasEnvDoc = !!this.options.environment;
  }

  async initialize(context) {
    const identity = context?.userId || 'anonymous';

    const initOpts = {
      environmentID: this.options.environmentID || 'local-offline',
      identity,
      cacheFlags: true,
      enableAnalytics: false,
      // Prevent any network calls for offline demos
      fetch: undefined,
    };

    // Prefer full local evaluation if an environment document is available
    if (this.options.environment) {
      initOpts.evaluateFlagsLocally = true;
      initOpts.environment = this.options.environment;
    } else if (this.options.bootstrap) {
      // Otherwise, preload static values
      initOpts.bootstrap = this.options.bootstrap;
    }

    await flagsmith.init(initOpts);

    // Ensure rules that check `property: "userId"` can match locally by setting a trait.
    // (Identity alone is separate from traits in Flagsmith.)
    try {
      await flagsmith.setTrait('userId', identity);
    } catch {
      // no-op offline
    }
  }

  async onContextChange(_oldCtx, newCtx) {
    const identity = newCtx?.userId || 'anonymous';
    // Re-identify to re-evaluate flags for this user
    await flagsmith.identify(identity);

    // Keep the trait in sync as well (needed for segment/rule evaluation on property "userId")
    try {
      await flagsmith.setTrait('userId', identity);
    } catch {
      // no-op offline
    }
  }

  async shutdown() {
    // Flagsmith web SDK has no explicit shutdown
  }

  // ---- OpenFeature resolver mappings ----

  resolveBooleanEvaluation(flagKey, defaultValue) {
    const v = flagsmith.getValue(flagKey);
    const value =
      v === undefined || v === null
        ? !!defaultValue
        : typeof v === 'boolean'
          ? v
          : typeof v === 'string'
            ? v.toLowerCase() === 'true'
            : typeof v === 'number'
              ? v !== 0
              : !!defaultValue;

    return { value, variant: undefined, reason: 'STATIC' };
  }

  resolveStringEvaluation(flagKey, defaultValue) {
    const v = flagsmith.getValue(flagKey);
    const value = v === undefined || v === null ? String(defaultValue) : String(v);
    return { value, variant: undefined, reason: 'STATIC' };
  }

  resolveNumberEvaluation(flagKey, defaultValue) {
    const v = flagsmith.getValue(flagKey);
    let value;
    if (v === undefined || v === null) {
      value = Number(defaultValue);
    } else if (typeof v === 'number') {
      value = v;
    } else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      value = Number(v);
    } else {
      value = Number(defaultValue);
    }
    return { value, variant: undefined, reason: 'STATIC' };
  }

  resolveObjectEvaluation(flagKey, defaultValue) {
    const v = flagsmith.getValue(flagKey);
    const value = v === undefined || v === null ? defaultValue : v;
    return { value, variant: undefined, reason: 'STATIC' };
  }
}

// -------- Public initializer used by your app --------

export async function initFlagsmith() {
  // Try to load full environment (segments + rules) for offline targeting parity with flagd
  let environment = null;
  let bootstrap = null;

  try {
    const resEnv = await fetch('/flagsmith/environment.json', { cache: 'no-store' });
    if (resEnv.ok) {
      environment = await resEnv.json();
    }
  } catch {
    // ignore, fall back to bootstrap
  }

  if (!environment) {
    try {
      const resBoot = await fetch('/flagsmith/bootstrap.json', { cache: 'no-store' });
      if (resBoot.ok) {
        bootstrap = await resBoot.json();
      }
    } catch {
      // ignore, provider will just rely on OpenFeature defaults
    }
  }

  const provider = new FlagsmithOFProvider({
    environmentID: 'local-offline',
    environment, // preferred (supports user targeting offline)
    bootstrap,   // fallback (static defaults only)
  });

  await OpenFeature.setProviderAndWait(provider);
  return OpenFeature.getClient('frontend');
}