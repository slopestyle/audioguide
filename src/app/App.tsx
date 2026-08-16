import { useEffect } from 'preact/hooks';
import { t } from '../core/i18n';
import { applyToDocument, lang } from '../core/lang';
import { fetchGuide, guide, guideFailed } from './guide';
import { route } from './router';
import { KeypadScreen } from './screens/KeypadScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { ListScreen } from './screens/ListScreen';
import { StandScreen } from './screens/StandScreen';

export function App() {
  const current = lang.value;

  useEffect(() => {
    void fetchGuide();
  }, []);

  useEffect(() => {
    if (current) applyToDocument(current);
  }, [current]);

  if (!current) return <LanguageScreen />;

  if (guideFailed.value) {
    return (
      <main class="page">
        <div class="notice">
          <strong>{t('loadError')}</strong>
          <button class="btn btn--primary btn--block" onClick={() => void fetchGuide()}>
            {t('retry')}
          </button>
        </div>
      </main>
    );
  }

  const data = guide.value;
  if (!data) {
    return (
      <main class="page">
        <p class="center muted">{t('loading')}</p>
      </main>
    );
  }

  const current_route = route.value;
  switch (current_route.name) {
    case 'stand':
      return <StandScreen guide={data} number={current_route.number} />;
    case 'list':
      return <ListScreen guide={data} />;
    case 'keypad':
      return <KeypadScreen guide={data} />;
  }
}
