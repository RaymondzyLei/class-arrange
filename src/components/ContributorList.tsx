import { useEffect, useMemo, useState } from 'react';
import { CONTRIBUTORS, PROJECT_LINKS } from '@/content/projectCredits';
import {
  getGithubContributorStats,
  type GithubContributorStatsByLogin,
} from '@/utils/githubContributorStats';
import { ExternalLinkIcon } from './icons';

type ContributorListVariant = 'detail' | 'links';

interface Props {
  className?: string;
  variant?: ContributorListVariant;
}

interface ContributorAvatarProps {
  name: string;
  src?: string;
}

function ContributorAvatar({ name, src }: ContributorAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && src !== failedSrc);

  return (
    <span className="contributor-list__avatar" aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          width="48"
          height="48"
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span className="contributor-list__avatar-fallback">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </span>
  );
}

function ContributorLinks({ className }: Pick<Props, 'className'>) {
  return (
    <div
      className={['contributor-list-wrap', 'contributor-list-wrap--links', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <ol className="contributor-link-list" aria-label="项目贡献者">
        {CONTRIBUTORS.map((contributor) => (
          <li key={contributor.name}>
            <a
              className="contributor-list__link"
              href={contributor.url}
              target="_blank"
              rel="noreferrer"
            >
              {contributor.name}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ContributorDetails({ className }: Pick<Props, 'className'>) {
  const [stats, setStats] = useState<GithubContributorStatsByLogin>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const summary = useMemo(
    () => Object.values(stats).reduce(
      (total, item) => ({
        additions: total.additions + item.additions,
        commits: total.commits + item.commits,
        deletions: total.deletions + item.deletions,
      }),
      { additions: 0, commits: 0, deletions: 0 },
    ),
    [stats],
  );

  useEffect(() => {
    let active = true;
    getGithubContributorStats()
      .then((value) => {
        if (!active) return;
        setStats(value);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const formatSummaryValue = (value: number) => (
    status === 'ready' ? numberFormatter.format(value) : '—'
  );
  const readyContributorCount = Object.keys(stats).length;
  const statusText = status === 'loading'
    ? '正在读取 GitHub 公开统计…'
    : status === 'error'
      ? 'GitHub 统计暂不可用，贡献者主页仍可访问。'
      : `${readyContributorCount} 位作者有公开提交统计`;

  return (
    <div
      className={[
        'contributor-list-wrap',
        'contributor-list-wrap--detail',
        className ?? '',
      ].filter(Boolean).join(' ')}
      aria-busy={status === 'loading'}
    >
      <section className="contributor-summary" aria-labelledby="contributor-summary-title">
        <div className="contributor-summary__copy">
          <span className="contributor-summary__eyebrow">GitHub contributions</span>
          <h3 id="contributor-summary-title">项目贡献概览</h3>
          <span className="contributor-summary__status" role="status" aria-live="polite">
            {statusText}
          </span>
        </div>
        <dl className="contributor-summary__metrics" aria-label="项目公开贡献统计汇总">
          <div className="contributor-summary__metric contributor-summary__metric--commits">
            <dt>commits</dt>
            <dd>{formatSummaryValue(summary.commits)}</dd>
          </div>
          <div className="contributor-summary__metric contributor-summary__metric--additions">
            <dt>++</dt>
            <dd>{formatSummaryValue(summary.additions)}</dd>
          </div>
          <div className="contributor-summary__metric contributor-summary__metric--deletions">
            <dt>--</dt>
            <dd>{formatSummaryValue(summary.deletions)}</dd>
          </div>
        </dl>
      </section>

      <div className="contributor-list__heading">
        <h3>贡献者</h3>
        <span>{CONTRIBUTORS.length} 位</span>
      </div>

      <ol className="contributor-list" aria-label="项目贡献者">
        {CONTRIBUTORS.map((contributor) => {
          const githubStats = contributor.githubLogin
            ? stats[contributor.githubLogin.toLowerCase()]
            : undefined;
          const fallbackAvatarUrl = contributor.githubLogin
            ? `https://github.com/${encodeURIComponent(contributor.githubLogin)}.png?size=96`
            : undefined;
          const profileLabel = contributor.profileLabel
            ?? (contributor.githubLogin ? `@${contributor.githubLogin}` : '外部主页');

          return (
            <li className="contributor-list__item" key={contributor.name}>
              <ContributorAvatar
                name={contributor.name}
                src={githubStats?.avatarUrl ?? contributor.avatarUrl ?? fallbackAvatarUrl}
              />
              <div className="contributor-list__identity">
                <a
                  className="contributor-list__profile-link"
                  href={contributor.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="contributor-list__name">{contributor.name}</span>
                  <ExternalLinkIcon className="contributor-list__external-icon" />
                </a>
                <span className="contributor-list__handle">{profileLabel}</span>
              </div>
              {githubStats ? (
                <dl
                  className="contributor-list__metrics"
                  aria-label={`${githubStats.commits} commits，新增 ${githubStats.additions} 行，删除 ${githubStats.deletions} 行`}
                >
                  <div className="contributor-list__metric contributor-list__metric--commits">
                    <dt>commits</dt>
                    <dd>{numberFormatter.format(githubStats.commits)}</dd>
                  </div>
                  <div className="contributor-list__metric contributor-list__metric--additions">
                    <dt>++</dt>
                    <dd>{numberFormatter.format(githubStats.additions)}</dd>
                  </div>
                  <div className="contributor-list__metric contributor-list__metric--deletions">
                    <dt>--</dt>
                    <dd>{numberFormatter.format(githubStats.deletions)}</dd>
                  </div>
                </dl>
              ) : (
                <span className="contributor-list__unavailable">
                  {status === 'loading' && contributor.githubLogin ? '正在读取…' : null}
                  {status === 'error' && contributor.githubLogin ? '统计暂不可用' : null}
                  {!contributor.githubLogin ? '未单独统计' : null}
                  {status === 'ready' && contributor.githubLogin ? '暂无公开统计' : null}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="contributor-list__source">
        数据来自{' '}
        <a
          className="contributor-list__link"
          href={PROJECT_LINKS.contributorsGraph}
          target="_blank"
          rel="noreferrer"
        >
          GitHub 公开统计
        </a>
        ，不含合并提交和空提交。
      </p>
    </div>
  );
}

export default function ContributorList({ className, variant = 'detail' }: Props) {
  return variant === 'links'
    ? <ContributorLinks className={className} />
    : <ContributorDetails className={className} />;
}
