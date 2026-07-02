import { Button, Layout, Typography } from 'antd';
import { exportPrint } from '@/utils/exportPrint';

const { Header } = Layout;
const { Title } = Typography;

export default function TopBar() {
  return (
    <Header
      className="no-print"
      style={{
        background: '#fff',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: 56,
      }}
    >
      <Title level={4} style={{ margin: 0 }}>
        中国科大选课协助
      </Title>
      <Button onClick={exportPrint}>
        打印 / 导出 PDF
      </Button>
    </Header>
  );
}
