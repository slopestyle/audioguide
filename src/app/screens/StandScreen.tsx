import { useEffect, useRef, useState } from 'preact/hooks';
import { asset, findStand, neighbours, viewStand } from '../../core/content';
import { t } from '../../core/i18n';
import { langInfo, setLang, uiLang } from '../../core/lang';
import {
  failed,
  open as openTrack,
  playing,
  position,
  release,
  retry,
  setTrackNavigation,
} from '../../core/player';
import type { Guide } from '../../core/types';
import { Header } from '../../ui/Header';
import { PlayerBar } from '../../ui/PlayerBar';
import { SettingsPanel } from '../../ui/SettingsPanel';
import { go, paths } from '../router';

export function StandScreen({ guide, number }: { guide: Guide; number: number }) {
  const current = uiLang();
  const stand = findStand(guide, number);
  const view = stand ? viewStand(stand, current, guide.languages) : undefined;

  const [textOpen, setTextOpen] = useState(false);
  const lastNumber = useRef<number | null>(null);

  const audioSrc = view?.audio?.audio ? asset(view.audio.audio) : null;
  const title = view?.requested?.title ?? view?.audio?.title ?? '';
  const artwork = stand?.photo ? asset(stand.photo) : undefined;

  useEffect(() => {
    if (!audioSrc) {
      release();
      return;
    }
    // Тот же стенд, другой язык — продолжаем с той же секунды и в том же
    // состоянии; новый стенд — с начала и сразу играем.
    const sameStand = lastNumber.current === number;
    openTrack(
      audioSrc,
      { number, title, artwork },
      { at: sameStand ? position.peek() : 0, autoplay: sameStand ? playing.peek() : true },
    );
    lastNumber.current = number;
  }, [audioSrc, number]);

  const { prev, next } = stand ? neighbours(guide, number) : {};

  useEffect(() => {
    setTrackNavigation(
      prev === undefined ? null : () => go(paths.stand(prev)),
      next === undefined ? null : () => go(paths.stand(next)),
    );
  }, [prev, next]);

  if (!stand || !view) {
    return (
      <main class="page">
        <Header back />
        <SettingsPanel />
        <div class="notice">
          <strong class="title title--lg">
            {t('standNotFound')} — № {number}
          </strong>
          <span>{t('checkNumber')}</span>
          <a class="btn btn--block" href={paths.list}>
            {t('allStands')}
          </a>
        </div>
      </main>
    );
  }

  const transcript = view.requested?.text ?? view.audio?.text;
  const transcriptLang = view.requested?.text ? current : (view.audioLang ?? current);

  return (
    <main class="page">
      <Header number={number} back />
      <SettingsPanel />

      {stand.photo && (
        <div class="photo">
          <img src={asset(stand.photo)} alt="" />
        </div>
      )}

      <h2 class="title title--lg">{title}</h2>

      {audioSrc && failed.value && (
        <div class="notice">
          <span>{t('audioError')}</span>
          <button class="btn btn--primary btn--block" onClick={retry}>
            {t('retry')}
          </button>
        </div>
      )}

      {audioSrc && !failed.value && <PlayerBar knownDuration={view.audio?.duration} />}

      {view.audioLang && view.audioLang !== current && (
        <p class="muted">
          {t('playingIn')} {langInfo(view.audioLang).label}
        </p>
      )}

      {!view.requested?.audio && view.audioLangs.length > 0 && (
        <div class="notice">
          <strong>{t('noAudioInLang')}</strong>
          <span>{t('availableIn')}</span>
          <div class="row">
            {view.audioLangs.map((code) => (
              <button
                key={code}
                class="btn"
                lang={code}
                dir={langInfo(code).dir}
                onClick={() => setLang(code)}
              >
                {langInfo(code).label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view.audioLangs.length === 0 && (
        <div class="notice">
          <span>{t('noAudioYet')}</span>
        </div>
      )}

      {transcript && (
        <>
          <button
            class="btn btn--block"
            onClick={() => setTextOpen(!textOpen)}
            aria-expanded={textOpen}
          >
            {textOpen ? t('hideText') : t('showText')}
          </button>
          {textOpen && (
            <div class="transcript" lang={transcriptLang} dir={langInfo(transcriptLang).dir}>
              {transcript}
            </div>
          )}
        </>
      )}

      <nav class="row">
        {prev !== undefined && (
          <a class="btn" href={paths.stand(prev)} aria-label={t('prev')}>
            <span aria-hidden="true">← {prev}</span>
          </a>
        )}
        <a class="btn" href={paths.list} style="flex:1">
          {t('allStands')}
        </a>
        {next !== undefined && (
          <a class="btn" href={paths.stand(next)} aria-label={t('next')}>
            <span aria-hidden="true">{next} →</span>
          </a>
        )}
      </nav>
    </main>
  );
}
