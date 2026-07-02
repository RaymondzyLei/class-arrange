import { Statistic, Col, Row } from 'antd';
import type { PlanStats } from '@/utils/stats';

interface Props {
  stats: PlanStats;
}

export default function StatsBar({ stats }: Props) {
  return (
    <div className="panel-inner no-print" style={{ padding: '8px 16px' }}>
      <Row gutter={24}>
        <Col>
          <Statistic title="已选课程" value={stats.count} suffix="门" />
        </Col>
        <Col>
          <Statistic title="总学分" value={stats.totalCredits} />
        </Col>
        <Col>
          <Statistic title="总学时" value={stats.totalHours} />
        </Col>
        <Col>
          <Statistic
            title="冲突课程"
            value={stats.conflictCount}
            suffix="门"
            styles={stats.conflictCount > 0 ? { content: { color: '#ff4d4f' } } : undefined}
          />
        </Col>
      </Row>
    </div>
  );
}
