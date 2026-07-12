import { PROJECT_LINKS } from '../content/projectCredits';

interface GithubContributorWeek {
  a?: number;
  d?: number;
}

interface GithubContributorResponse {
  author?: {
    avatar_url?: string;
    html_url?: string;
    login?: string;
  } | null;
  total?: number;
  weeks?: GithubContributorWeek[];
}

export interface GithubContributorStats {
  additions: number;
  avatarUrl?: string;
  commits: number;
  deletions: number;
  profileUrl?: string;
}

export type GithubContributorStatsByLogin = Record<string, GithubContributorStats>;

const CACHE_KEY = 'class-arrange:v2:github-contributor-stats';
const CACHE_DURATION_MS = 30 * 60 * 1000;
let memoryCache: { expiresAt: number; value: GithubContributorStatsByLogin } | null = null;
let pendingRequest: Promise<GithubContributorStatsByLogin> | null = null;

function readCachedStats(): GithubContributorStatsByLogin | null {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) return memoryCache.value;

  try {
    const cached = window.sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as {
      expiresAt?: number;
      value?: GithubContributorStatsByLogin;
    };
    if (!parsed.expiresAt || parsed.expiresAt <= now || !parsed.value) return null;
    memoryCache = { expiresAt: parsed.expiresAt, value: parsed.value };
    return parsed.value;
  } catch {
    return null;
  }
}

function cacheStats(value: GithubContributorStatsByLogin) {
  const cached = { expiresAt: Date.now() + CACHE_DURATION_MS, value };
  memoryCache = cached;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage may be unavailable in privacy-focused browser contexts.
  }
}

export function summarizeGithubContributorStats(
  payload: GithubContributorResponse[],
): GithubContributorStatsByLogin {
  return Object.fromEntries(payload.flatMap((entry) => {
    const login = entry.author?.login?.toLowerCase();
    if (!login) return [];
    const weeks = Array.isArray(entry.weeks) ? entry.weeks : [];
    const avatarUrl = entry.author?.avatar_url?.trim();
    const profileUrl = entry.author?.html_url?.trim();
    return [[login, {
      additions: weeks.reduce((sum, week) => sum + (Number(week.a) || 0), 0),
      ...(avatarUrl ? { avatarUrl } : {}),
      commits: Number(entry.total) || 0,
      deletions: weeks.reduce((sum, week) => sum + (Number(week.d) || 0), 0),
      ...(profileUrl ? { profileUrl } : {}),
    }]];
  }));
}

async function requestGithubStats(): Promise<GithubContributorStatsByLogin> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(PROJECT_LINKS.contributorsApi, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (response.status === 202) {
        await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`GitHub contributor statistics: ${response.status}`);
      const payload = await response.json() as GithubContributorResponse[];
      const stats = summarizeGithubContributorStats(Array.isArray(payload) ? payload : []);
      cacheStats(stats);
      return stats;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error('GitHub contributor statistics are still being prepared');
}

export function getGithubContributorStats(): Promise<GithubContributorStatsByLogin> {
  const cached = readCachedStats();
  if (cached) return Promise.resolve(cached);
  if (!pendingRequest) {
    pendingRequest = requestGithubStats().finally(() => {
      pendingRequest = null;
    });
  }
  return pendingRequest;
}
