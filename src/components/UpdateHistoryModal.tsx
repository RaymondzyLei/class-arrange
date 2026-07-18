import type { AppRelease } from '@/updates/appUpdates';
import type { SemesterUpdateHistory } from '@/updates/updateAwareness';
import BottomModal from './BottomModal';
import CourseUpdateBatchDetails from './CourseUpdateBatchDetails';

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
  const courseHistories = semesters.filter(({ entries }) => entries.length > 0);

  return (
    <BottomModal open={open} title="更新记录" onClose={onClose} width={760} className="update-modal">
      <div className="update-modal__content">
        {loading ? <p className="update-history__status">正在读取更新记录…</p> : null}
        {failedSemesterKeys.length > 0 ? (
          <p className="update-history__status update-history__status--error">
            部分学期更新记录加载失败，下次打开时会重试。
          </p>
        ) : null}
        <section className="update-section">
          <h3>网站更新</h3>
          {appReleases.length > 0 ? appReleases.slice().reverse().map((release) => (
            <article className="update-history__entry" key={release.version}>
              <div className="update-history__entry-header">
                <strong>{release.title}</strong><time>{release.publishedAt}</time>
              </div>
              <ul>{release.items.map((item) => <li key={item}>{item}</li>)}</ul>
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
                    {entries.slice().reverse().map((entry) => (
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
