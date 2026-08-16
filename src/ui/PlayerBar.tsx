import { formatTime } from '../core/format';
import { t } from '../core/i18n';
import { duration, playing, position, seek, skip, toggle } from '../core/player';

interface Props {
  /** Длительность из content.json — показываем, пока не загрузились метаданные. */
  knownDuration?: number;
}

export function PlayerBar({ knownDuration }: Props) {
  const total = duration.value || knownDuration || 0;

  return (
    <div class="player">
      <div class="player__row">
        <button
          class="btn btn--primary"
          onClick={toggle}
          aria-label={playing.value ? t('pause') : t('play')}
        >
          <span aria-hidden="true" style="font-size:1.5rem">
            {playing.value ? '❚❚' : '▶'}
          </span>
        </button>
        <input
          class="seek"
          type="range"
          min={0}
          max={Math.max(total, 1)}
          step={1}
          value={Math.min(position.value, total || position.value)}
          onInput={(event) => seek(Number(event.currentTarget.value))}
          aria-label={t('guide')}
          aria-valuetext={`${formatTime(position.value)} / ${formatTime(total)}`}
        />
      </div>

      <div class="player__row">
        <button class="btn" onClick={() => skip(-15)} aria-label={t('back15')}>
          <span aria-hidden="true">−15</span>
        </button>
        <span class="player__time" role="timer" aria-live="off">
          {formatTime(position.value)} / {formatTime(total)}
        </span>
        <button class="btn" onClick={() => skip(15)} aria-label={t('forward15')}>
          <span aria-hidden="true">+15</span>
        </button>
      </div>
    </div>
  );
}
