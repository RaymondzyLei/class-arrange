import type {
  CourseFieldChange,
  CourseImpactEvent,
  SelectedCourseSnapshot,
} from '@/types';
import type { AutomaticNoticeSelection } from '@/updates/updateAwareness';
import { newestFirstByDate } from '../updates/updateOrdering';
import BottomModal from './BottomModal';
import CourseUpdateBatchDetails from './CourseUpdateBatchDetails';
import { WarningIcon } from './icons';

interface Props {
  open: boolean;
  notice: AutomaticNoticeSelection;
  onClose: () => void;
  afterClose?: () => void;
  onSelectReplacement?: (
    event: CourseImpactEvent,
    candidate: SelectedCourseSnapshot,
  ) => void;
}

function affectedPlanText(event: CourseImpactEvent): string {
  return event.affectedPlans
    .map((plan) => plan.wasActive ? `当前方案“${plan.planName}”` : `方案“${plan.planName}”`)
    .join('和');
}

function changeValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value || '无');
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== 'object') return String(item);
      const slot = item as Record<string, unknown>;
      const weeks = Array.isArray(slot.weeks) ? `第${slot.weeks.join('、')}周` : '';
      const day = typeof slot.day === 'number' ? `周${'一二三四五六日'[slot.day - 1]}` : '';
      const periods = Array.isArray(slot.periods) ? `第${slot.periods.join('、')}节` : '';
      const room = typeof slot.room === 'string' ? slot.room : '';
      const campus = typeof slot.campus === 'string' ? slot.campus : '';
      return [weeks, day, periods, room, campus].filter(Boolean).join(' ');
    }).join('；') || '无';
  }
  return value == null ? '无' : String(value);
}

function ChangeRow({ change }: { change: CourseFieldChange }) {
  return (
    <li className="update-change-row">
      <span className="update-change-row__label">{change.label}</span>
      {'before' in change || 'after' in change ? (
        <span className="update-change-row__value">
          {changeValue(change.before)} <span aria-hidden="true">→</span> {changeValue(change.after)}
        </span>
      ) : null}
    </li>
  );
}

export default function UpdateNoticeModal({
  open,
  notice,
  onClose,
  afterClose,
  onSelectReplacement,
}: Props) {
  const removed = notice.impacts.filter((impact) => impact.kind === 'removed');
  const modified = notice.impacts.filter((impact) => impact.kind === 'modified');
  const appReleases = newestFirstByDate(notice.appReleases, (release) => release.publishedAt);
  const semesterUpdates = newestFirstByDate(
    notice.semesterUpdates.filter((item) => item.entries.length > 0),
    ({ entries }) => newestFirstByDate(entries, (entry) => entry.publishedAt)[0]?.publishedAt ?? '',
  );
  return (
    <BottomModal
      open={open}
      title="最近更新"
      onClose={onClose}
      afterClose={afterClose}
      width={760}
      className="update-modal"
      footer={<button type="button" className="update-modal__confirm" onClick={onClose}>知道了</button>}
    >
      <div className="update-modal__content">
        {removed.length > 0 ? (
          <section className="update-section update-section--danger">
            <h3>
              <WarningIcon className="update-section__danger-icon" />
              部分课程已失效
            </h3>
            <p className="update-section__lead">以下课堂已从新课程目录中删除，已自动同步清理方案中的这些课程。</p>
            <div className="update-card-list">
              {removed.map((event) => (
                <article className="update-card update-card--danger" key={event.id}>
                  <h4 className="update-card__heading">
                    <span className="update-card__name">{event.courseName}</span>
                    <span className="update-card__code">{event.courseId}</span>
                    <span
                      className="update-card__teacher"
                      title={event.previous.teacher || '待定'}
                    >
                      {event.previous.teacher || '待定'}
                    </span>
                  </h4>
                  <p>已从{affectedPlanText(event)}中移出。</p>
                  {event.replacementCandidates.length > 0 ? (
                    <div className="update-candidates">
                      <strong>可能的新课堂</strong>
                      <ul>
                        {event.replacementCandidates.map((candidate) => (
                          <li key={candidate.id}>
                            <span className="update-candidates__identity">
                              <span className="update-candidates__name">{candidate.courseName}</span>
                              <span className="update-candidates__meta">
                                <span>{candidate.id}</span>
                                <span>{candidate.teacher || '教师待定'}</span>
                              </span>
                            </span>
                            {onSelectReplacement ? (
                              <button
                                type="button"
                                onClick={() => onSelectReplacement(event, candidate)}
                              >
                                替换失效课程
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <small>课堂号变更不会自动替换；请核对候选课堂后再选择。</small>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {modified.length > 0 ? (
          <section className="update-section">
            <h3>已选课程信息有变化</h3>
            <div className="update-card-list">
              {modified.map((event) => (
                <article className="update-card" key={event.id}>
                  <h4>{event.courseName} <span>{event.courseId}</span></h4>
                  <p>涉及：{affectedPlanText(event)}</p>
                  <ul className="update-change-list">
                    {event.changes.map((change) => (
                      <ChangeRow key={change.field} change={change} />
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {appReleases.length > 0 ? (
          <section className="update-section">
            <h3>网站更新</h3>
            {appReleases.map((release) => (
              <article className="update-release" key={release.version}>
                <div className="update-release__header"><strong>{release.title}</strong><time>{release.publishedAt}</time></div>
                <ul>{release.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </section>
        ) : null}

        {semesterUpdates.map(({ semester, entries }) => (
          <section className="update-section" key={semester.key}>
            <h3>{semester.name}课程更新</h3>
            {newestFirstByDate(entries, (entry) => entry.publishedAt).map((entry) => (
              <article className="update-release" key={entry.id}>
                <div className="update-release__header"><strong>{entry.publishedAt.slice(0, 10) || '课程目录更新'}</strong></div>
                <p>新增 {entry.summary.added} 个课堂，删除 {entry.summary.removed} 个课堂，修改 {entry.summary.modified} 个课堂。</p>
                <CourseUpdateBatchDetails batch={entry} />
              </article>
            ))}
          </section>
        ))}
      </div>
    </BottomModal>
  );
}
