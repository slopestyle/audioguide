import { useState } from 'preact/hooks';
import { LANGS } from '../../core/lang';
import type { Guide } from '../../core/types';
import { addStand, readiness, type Readiness } from '../draft';

const LABEL: Record<Readiness, string> = {
  empty: 'нет',
  text: 'текст',
  ready: 'готово',
};

/** Главный экран: за секунду видно, где чего не хватает. */
export function MatrixScreen({ guide, onOpen }: { guide: Guide; onOpen: (number: number) => void }) {
  const [adding, setAdding] = useState('');

  function add() {
    const number = Number(adding);
    if (!Number.isInteger(number) || number <= 0) return;
    if (!addStand(number)) {
      alert(`Стенд № ${number} уже есть`);
      return;
    }
    setAdding('');
    onOpen(number);
  }

  const missing = guide.stands.reduce(
    (total, stand) => total + LANGS.filter((l) => readiness(stand, l.code) !== 'ready').length,
    0,
  );

  return (
    <section>
      <h2 class="title title--lg">Готовность экспозиции</h2>
      <p class="muted">
        Стендов: {guide.stands.length}. Не озвучено ячеек: {missing} из{' '}
        {guide.stands.length * LANGS.length}.
      </p>

      <div class="matrix-scroll">
        <table class="matrix">
          <thead>
            <tr>
              <th scope="col">№</th>
              <th scope="col">Название</th>
              {LANGS.map((item) => (
                <th scope="col" key={item.code}>
                  {item.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.stands.map((stand) => (
              <tr key={stand.number} onClick={() => onOpen(stand.number)}>
                <th scope="row">{stand.number}</th>
                <td>{stand.content.ru?.title ?? <span class="muted">без названия</span>}</td>
                {LANGS.map((item) => {
                  const state = readiness(stand, item.code);
                  return (
                    <td key={item.code} class={`cell cell--${state}`}>
                      <span class="sr-only">
                        {item.label}: {LABEL[state]}
                      </span>
                      <span aria-hidden="true">
                        {state === 'ready' ? '♪' : state === 'text' ? 'Т' : '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="row">
        <input
          class="input input--narrow"
          inputMode="numeric"
          placeholder="Номер"
          value={adding}
          onInput={(event) => setAdding(event.currentTarget.value)}
        />
        <button class="btn" onClick={add} disabled={!adding}>
          Добавить стенд
        </button>
      </div>
    </section>
  );
}
