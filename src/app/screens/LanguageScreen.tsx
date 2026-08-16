import { LANGS, setLang } from '../../core/lang';
import { go, paths } from '../router';

/** Первый экран: без него неизвестно, на каком языке говорить об ошибках. */
export function LanguageScreen() {
  return (
    <main class="page">
      <h1 class="title title--xl center">Музей друзей</h1>
      <p class="center muted">Аудиогид · Audio guide · 语音导览 · الدليل الصوتي</p>

      <div class="list">
        {LANGS.map((item) => (
          <button
            key={item.code}
            class="btn btn--lang btn--block"
            lang={item.code}
            dir={item.dir}
            onClick={() => {
              setLang(item.code);
              go(paths.keypad);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </main>
  );
}
