import type { AppRelease } from '@/updates/appUpdates';
import type { SemesterUpdateHistory } from '@/updates/updateAwareness';
import { newestFirstByDate } from '../updates/updateOrdering';
import { FEEDBACK_FORM_URL } from '@/config/feedback';
import BottomModal from './BottomModal';
import CourseUpdateBatchDetails from './CourseUpdateBatchDetails';
import { WarningIcon } from './icons';

interface Props {
  open: boolean;
  loading: boolean;
  failedSemesterKeys: string[];
  appReleases: AppRelease[];
  semesters: SemesterUpdateHistory[];
  onClose: () => void;
}

export default function UpdateHistoryModal({
  open,
  loading,
  failedSemesterKeys,
  appReleases,
  semesters,
  onClose,
}: Props) {
  const courseHistories = newestFirstByDate(
    semesters.filter(({ entries }) => entries.length > 0),
    ({ entries }) => newestFirstByDate(entries, (entry) => entry.publishedAt)[0]?.publishedAt ?? '',
  );
  const orderedAppReleases = newestFirstByDate(appReleases, (release) => release.publishedAt);

  return (
    <BottomModal open={open} title="更新记录" onClose={onClose} width={760} className="update-modal">
      <div className="update-modal__content">
        {loading ? <p className="update-history__status">正在读取更新记录…</p> : null}
        {failedSemesterKeys.length > 0 ? (
          <p className="update-history__status update-history__status--error">
            部分学期更新记录加载失败，下次打开时会重试。
          </p>
        ) : null}
        <section className="update-section update-section--danger update-feedback">
          <h3>
            <WarningIcon className="update-section__danger-icon" />
            用户反馈
          </h3>
          <p>
            遇到问题或有建议？<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">填写反馈表单</a>，帮助我们持续改进。
          </p>
        </section>
        <section className="update-section">
          <h3>网站更新</h3>
          {orderedAppReleases.length > 0 ? orderedAppReleases.map((release) => (
            <article className="update-history__entry" key={release.version}>
              <div className="update-history__entry-header">
                <strong>{release.title}</strong><time>{release.publishedAt}</time>
              </div>
              <ul>{release.items.map((item) => (
                <li
                  className={release.dangerItems?.includes(item)
                    ? 'update-release__item--danger'
                    : undefined}
                  key={item}
                >
                  {item}
                </li>
              ))}</ul>
            </article>
          )) : <p>暂无网站更新记录。</p>}
        </section>
        <section className="update-section">
          <h3>课程信息更新</h3>
          {courseHistories.length > 0 ? (
            <div className="update-history__semester-list">
              {courseHistories.map(({ semester, entries }) => (
                <section className="update-history__semester" key={semester.key}>
                  <h4>{semester.name}</h4>
                  <div className="update-history__group">
                    {newestFirstByDate(entries, (entry) => entry.publishedAt).map((entry) => (
                      <article className="update-history__entry" key={entry.id}>
                        <div className="update-history__entry-header">
                          <strong>{entry.publishedAt.slice(0, 10) || '课程目录更新'}</strong>
                        </div>
                        <p>新增 {entry.summary.added} 个课堂，删除 {entry.summary.removed} 个课堂，修改 {entry.summary.modified} 个课堂。</p>
                        <CourseUpdateBatchDetails batch={entry} />
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : <p>暂无课程更新记录。</p>}
        </section>
      </div>
    </BottomModal>
  );
}
