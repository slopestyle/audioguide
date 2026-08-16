import { standTitle } from '../../core/content';
import { t } from '../../core/i18n';
import { uiLang } from '../../core/lang';
import type { Guide } from '../../core/types';
import { Header } from '../../ui/Header';
import { SettingsPanel } from '../../ui/SettingsPanel';
import { paths } from '../router';

export function ListScreen({ guide }: { guide: Guide }) {
  const current = uiLang();

  return (
    <main class="page">
      <Header back />
      <SettingsPanel />

      <h2 class="title title--lg">{t('allStands')}</h2>

      <ul class="list">
        {guide.stands.map((stand) => (
          <li key={stand.number}>
            <a class="list__link" href={paths.stand(stand.number)}>
              <span class="list__number">{stand.number}</span>
              <span>{standTitle(stand, current, guide.languages)}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
