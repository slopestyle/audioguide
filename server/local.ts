import { createServer } from 'node:http';
import { handle, type Env } from './handler.ts';

/** Локальный запуск обработчика для разработки админки:
 *  node server/local.ts (переменные окружения — как у функции). */
const port = Number(process.env.PORT ?? 8787);

createServer((incoming, outgoing) => {
  const chunks: Buffer[] = [];
  incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
  incoming.on('end', () => {
    void handle(
      {
        method: incoming.method ?? 'GET',
        path: incoming.url ?? '/',
        headers: incoming.headers as Record<string, string | undefined>,
        body: Buffer.concat(chunks).toString('utf8'),
      },
      { ALLOWED_ORIGIN: 'http://localhost:5173', ...process.env } as Env,
    ).then((response) => {
      outgoing.writeHead(response.status, response.headers);
      outgoing.end(response.body === null ? '' : JSON.stringify(response.body));
    });
  });
}).listen(port, () => {
  console.log(`Обработчик админки: http://localhost:${port}`);
});
