export const PROJECT_LINKS = {
  repository: 'https://github.com/RaymondzyLei/class-arrange',
  contributorsGraph: 'https://github.com/RaymondzyLei/class-arrange/graphs/contributors',
  contributorsApi: 'https://api.github.com/repos/RaymondzyLei/class-arrange/stats/contributors',
  raymondHome: 'https://raymondzylei.me/',
  syhalexHome: 'https://shashousyh.github.io/syh/',
} as const;

export interface Contributor {
  name: string;
  url: string;
  avatarUrl?: string;
  githubLogin?: string;
  profileLabel?: string;
}

/** Single source of truth for every contributor list shown in the app. */
export const CONTRIBUTORS: readonly Contributor[] = [
  {
    name: 'RaymondzyLei',
    url: 'https://github.com/RaymondzyLei',
    githubLogin: 'RaymondzyLei',
  },
  { name: 'Claude', url: 'https://github.com/claude', githubLogin: 'claude' },
  { name: 'syhalex', url: PROJECT_LINKS.syhalexHome, githubLogin: 'syhalex' },
  {
    name: 'Codex',
    url: 'https://github.com/openai/codex',
    avatarUrl: 'https://avatars.githubusercontent.com/u/14957082?v=4',
    profileLabel: 'openai/codex',
  },
  {
    name: 'Quantai',
    url: 'https://github.com/quantai1314',
    githubLogin: 'quantai1314',
  },
];
