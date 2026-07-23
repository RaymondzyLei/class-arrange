import { Alert, Button, Spin } from 'antd';
import type { SharedPlanImportState } from '@/hooks/useSharedPlanImport';
import BottomModal from './BottomModal';

interface Props {
  state: SharedPlanImportState;
  onClose: () => void;
  onImport: () => void;
}

function modalTitle(state: SharedPlanImportState): string {
  if (state.kind === 'error') return '无法读取分享方案';
  if (state.kind === 'switching') return '正在加载分享方案';
  return '导入分享方案';
}

export default function SharedPlanImportModal({ state, onClose, onImport }: Props) {
  const open = state.kind !== 'closed';
  const preview = state.kind === 'preview' ? state.preview : null;

  return (
    <BottomModal
      className="shared-plan-import"
      title={modalTitle(state)}
      open={open}
      onClose={onClose}
      width={640}
      footer={preview ? (
        <>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={onImport} disabled={!preview.canImport}>
            导入方案
          </Button>
        </>
      ) : null}
    >
      {state.kind === 'switching' ? (
        <div className="shared-plan-import__loading">
          <Spin size="small" />
          <span>正在加载{state.semesterName}课程目录…</span>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <Alert
          type="error"
          showIcon
          title={state.message}
          description="链接可能已损坏、被截断，或者使用了不受支持的分享格式。"
        />
      ) : null}

      {state.kind === 'preview' ? (
        <div className="shared-plan-import__content">
          <dl className="shared-plan-import__summary">
            <div>
              <dt>来源方案</dt>
              <dd title={state.preview.payload.name}>{state.preview.payload.name}</dd>
            </div>
            <div>
              <dt>所属学期</dt>
              <dd title={state.semesterName}>{state.semesterName}</dd>
            </div>
            <div>
              <dt>导入名称</dt>
              <dd title={state.preview.importName}>{state.preview.importName}</dd>
            </div>
          </dl>

          <section className="shared-plan-import__section">
            <div className="shared-plan-import__section-heading">
              <h3>可导入课堂</h3>
              <span>{state.preview.validCourses.length} 个</span>
            </div>
            {state.preview.validCourses.length > 0 ? (
              <ul className="shared-plan-import__courses">
                {state.preview.validCourses.map((course) => (
                  <li key={course.id}>
                    <div className="shared-plan-import__course-main">
                      <strong>{course.courseName}</strong>
                      <span>{course.id}</span>
                    </div>
                    <span className="shared-plan-import__teacher">
                      {course.teacher || '任课教师待定'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="shared-plan-import__empty">没有仍然有效的课堂。</p>
            )}
          </section>

          {state.preview.missingCourseIds.length > 0 ? (
            <section className="shared-plan-import__section">
              <div className="shared-plan-import__section-heading">
                <h3>已失效课堂</h3>
                <span>{state.preview.missingCourseIds.length} 个，不会导入</span>
              </div>
              <div className="shared-plan-import__missing">
                {state.preview.missingCourseIds.join('、')}
              </div>
            </section>
          ) : null}

          {state.preview.blockReason ? (
            <Alert
              type="warning"
              showIcon
              title={state.preview.blockReason}
            />
          ) : null}
        </div>
      ) : null}
    </BottomModal>
  );
}
