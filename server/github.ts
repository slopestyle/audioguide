/** Публикация контента через Git Data API: несколько файлов уезжают одним
 *  коммитом, поэтому оборванная сеть не оставит стенд наполовину обновлённым. */

export interface Repo {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface Change {
  path: string;
  /** null — файл удаляется. */
  blobSha: string | null;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(repo: Repo, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${repo.token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new GitHubError(`GitHub ${path}: ${response.status} ${await response.text()}`, 502);
  }
  return (await response.json()) as T;
}

export async function head(repo: Repo): Promise<{ sha: string; treeSha: string; date: string }> {
  const ref = await api<{ object: { sha: string } }>(repo, `/git/ref/heads/${repo.branch}`);
  const commit = await api<{ tree: { sha: string }; committer: { date: string } }>(
    repo,
    `/git/commits/${ref.object.sha}`,
  );
  return { sha: ref.object.sha, treeSha: commit.tree.sha, date: commit.committer.date };
}

export async function createBlob(repo: Repo, base64: string): Promise<string> {
  const blob = await api<{ sha: string }>(repo, '/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: base64, encoding: 'base64' }),
  });
  return blob.sha;
}

export async function commit(
  repo: Repo,
  options: { baseSha: string; message: string; changes: Change[]; author: string },
): Promise<string> {
  const current = await head(repo);
  // Чужая публикация между чтением и записью: лучше предупредить,
  // чем молча затереть чужую работу.
  if (current.sha !== options.baseSha) {
    throw new GitHubError('Контент изменился с момента последней загрузки', 409);
  }

  const tree = await api<{ sha: string }>(repo, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: current.treeSha,
      tree: options.changes.map((change) => ({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: change.blobSha,
      })),
    }),
  });

  const created = await api<{ sha: string }>(repo, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: `${options.message}\n\nОпубликовал: ${options.author}`,
      tree: tree.sha,
      parents: [options.baseSha],
    }),
  });

  await api(repo, `/git/refs/heads/${repo.branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: created.sha, force: false }),
  });

  return created.sha;
}
