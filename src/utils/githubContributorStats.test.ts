import { describe, expect, it } from 'vitest';
import { summarizeGithubContributorStats } from './githubContributorStats';

describe('summarizeGithubContributorStats', () => {
  it('indexes contributors case-insensitively and sums their weekly changes', () => {
    expect(summarizeGithubContributorStats([
      {
        author: {
          avatar_url: 'https://avatars.githubusercontent.com/u/81847?v=4',
          html_url: 'https://github.com/claude',
          login: 'Claude',
        },
        total: 21,
        weeks: [
          { a: 226_000, d: 400 },
          { a: 494, d: 70 },
        ],
      },
      {
        author: null,
        total: 2,
        weeks: [{ a: 20, d: 5 }],
      },
    ])).toEqual({
      claude: {
        additions: 226_494,
        avatarUrl: 'https://avatars.githubusercontent.com/u/81847?v=4',
        commits: 21,
        deletions: 470,
        profileUrl: 'https://github.com/claude',
      },
    });
  });
});
