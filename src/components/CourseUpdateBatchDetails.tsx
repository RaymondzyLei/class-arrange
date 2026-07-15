import { useId, useState } from 'react';
import { Button } from 'antd';
import type { SemesterUpdateBatch } from '@/types';
import { ChevronIcon } from './icons';

export default function CourseUpdateBatchDetails({ batch }: { batch: SemesterUpdateBatch }) {
  const total = batch.summary.added + batch.summary.removed + batch.summary.modified;
  const [open, setOpen] = useState(total <= 10);
  const regionId = useId();
  if (total === 0) return null;
  return (
    <div className="course-update-details">
      <Button
        size="small"
        type="text"
        className="course-update-details__toggle"
        aria-controls={regionId}
        aria-expanded={open}
        icon={(
          <ChevronIcon
            className={`select-chevron${open ? ' select-chevron--open' : ''}`}
          />
        )}
        onClick={() => setOpen((current) => !current)}
      >
        查看具体变化
      </Button>
      <div
        id={regionId}
        className={`course-update-details__region${open ? ' course-update-details__region--open' : ''}`}
        aria-hidden={!open}
      >
        <div className="course-update-details__clip">
          <div className="course-update-details__groups">
            {batch.added.length > 0 ? (
              <section>
                <h5>新增课堂</h5>
                <ul>{batch.added.map((course) => (
                  <li key={course.id}>
                    <span>{course.courseName}</span>
                    <small>{course.id} {course.teacher || '待定'}</small>
                  </li>
                ))}</ul>
              </section>
            ) : null}
            {batch.removed.length > 0 ? (
              <section>
                <h5>删除课堂</h5>
                <ul>{batch.removed.map(({ course }) => (
                  <li key={course.id}>
                    <span>{course.courseName}</span>
                    <small>{course.id} {course.teacher || '待定'}</small>
                  </li>
                ))}</ul>
              </section>
            ) : null}
            {batch.modified.length > 0 ? (
              <section>
                <h5>修改课堂</h5>
                <ul>{batch.modified.map(({ course, changes }) => (
                  <li key={course.id}>
                    <span>{course.courseName}</span>
                    <small>{course.id} {course.teacher || '待定'} · {changes.map((change) => change.label).join('、')}</small>
                  </li>
                ))}</ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
