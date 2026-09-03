import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AI_MODELS, DEFAULT_AI_SETTINGS, type AiModel } from '@/persistence/db';
import { saveAiSettings } from '@/persistence/repositories';
import { AiError, testKey } from '@/lib/claude';
import { useT } from '../state/AppState';

const MODEL_LABEL: Record<AiModel, string> = {
  'claude-opus-5': 'Claude Opus — $$$',
  'claude-sonnet-5': 'Claude Sonnet — $$',
  'claude-haiku-4-5': 'Claude Haiku — $',
};

export function useAiSettings() {
  const row = useLiveQuery(() => db.aiSettings.get('main'), []);
  return { ...DEFAULT_AI_SETTINGS, ...row, key: 'main' as const };
}

export function errorText(kind: AiError['kind'], t: ReturnType<typeof useT>): string {
  switch (kind) {
    case 'auth':
      return t.ai.errAuth;
    case 'rate-limit':
      return t.ai.errRate;
    case 'network':
      return t.ai.errNetwork;
    case 'refusal':
      return t.ai.errRefusal;
    default:
      return t.ai.errUnknown;
  }
}

export function AiSettings() {
  const t = useT();
  const settings = useAiSettings();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | string>('idle');

  const hasKey = Boolean(settings.apiKey);

  const runTest = async () => {
    const effective = { ...settings, apiKey: keyInput.trim() || settings.apiKey };
    if (!effective.apiKey) return;
    setTest('testing');
    try {
      await testKey(effective);
      if (keyInput.trim()) await saveAiSettings({ apiKey: keyInput.trim() });
      setKeyInput('');
      setTest('ok');
    } catch (err) {
      setTest(errorText(err instanceof AiError ? err.kind : 'unknown', t));
    }
  };

  return (
    <div className="ai-settings">
      <label className="field field--row">
        <span className="field__label">{t.ai.enable}</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => void saveAiSettings({ enabled: e.target.checked })}
        />
      </label>

      <label className="field">
        <span className="field__label">{t.ai.keyLabel}</span>
        <div className="ai-key">
          <input
            className="input"
            type={showKey ? 'text' : 'password'}
            placeholder={hasKey ? '••••••••••••••••' : t.ai.keyPlaceholder}
            value={keyInput}
            autoComplete="off"
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button className="btn btn--quiet btn--sm" type="button" onClick={() => setShowKey((v) => !v)}>
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        <a
          className="xsmall muted"
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer noopener"
        >
          {t.ai.getKey} ↗
        </a>
      </label>

      <label className="field field--row">
        <span className="field__label">{t.ai.model}</span>
        <select
          className="input input--sm"
          value={settings.model}
          onChange={(e) => void saveAiSettings({ model: e.target.value as AiModel })}
        >
          {AI_MODELS.map((m) => (
            <option key={m} value={m}>
              {MODEL_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <span className="xsmall muted">{t.ai.modelHint}</span>

      <div className="row">
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          disabled={test === 'testing' || (!keyInput.trim() && !hasKey)}
          onClick={() => void runTest()}
        >
          {test === 'testing' ? t.ai.testing : t.ai.test}
        </button>
        {test === 'ok' ? <span className="xsmall" style={{ color: 'var(--success)' }}>{t.ai.testOk}</span> : null}
        {typeof test === 'string' && test !== 'idle' && test !== 'testing' && test !== 'ok' ? (
          <span className="xsmall" style={{ color: 'var(--danger)' }}>{test}</span>
        ) : null}
        {hasKey ? (
          <button
            className="btn btn--quiet btn--sm popmenu__danger"
            type="button"
            onClick={() => {
              void saveAiSettings({ apiKey: undefined, enabled: false });
              setTest('idle');
            }}
          >
            {t.ai.clearKey}
          </button>
        ) : null}
      </div>

      <p className="xsmall muted" style={{ maxWidth: '52ch' }}>
        {t.ai.privacy}
      </p>
    </div>
  );
}
