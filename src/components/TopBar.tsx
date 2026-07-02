import { Button, Layout, Tooltip, Typography } from 'antd';
import { exportPrint } from '@/utils/exportPrint';

const { Header } = Layout;
const { Title } = Typography;

interface Props {
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function TopBar({ themeMode, onToggleTheme }: Props) {
  const toggleLabel = themeMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式';
  return (
    <Header className="top-bar no-print">
      <div className="top-bar__brand">
        <span className="top-bar__logo" aria-hidden />
        <Title level={4} className="top-bar__title">
          中国科大选课协助
        </Title>
      </div>
      <div className="top-bar__actions">
        <Tooltip title={toggleLabel}>
          <Button
            className="theme-toggle"
            type="text"
            size="middle"
            onClick={onToggleTheme}
            aria-label={toggleLabel}
          >
            {themeMode === 'dark' ? '☀️' : '🌙'}
          </Button>
        </Tooltip>
        <Button type="primary" onClick={exportPrint}>
          打印 / 导出 PDF
        </Button>
      </div>
    </Header>
  );
}