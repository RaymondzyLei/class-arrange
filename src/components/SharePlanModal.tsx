import { useMemo } from 'react';
import { Alert, App, Button, Input } from 'antd';
import type { Plan } from '@/types';
import { buildSharedPlanUrl } from '@/utils/sharedPlan';
import BottomModal from './BottomModal';

interface Props {
  open: boolean;
  plan: Plan | null;
  semesterKey: string;
  semesterName: string;
  onClose: () => void;
}

interface LinkState {
  url: string;
  error: string | null;
}

export default function SharePlanModal({
  open,
  plan,
  semesterKey,
  semesterName,
  onClose,
}: Props) {
  const { message } = App.useApp();
  const linkState = useMemo<LinkState>(() => {
    if (!open || !plan || plan.courseIds.length === 0 || typeof window === 'undefined') {
      return { url: '', error: null };
    }
    try {
      return {
        url: buildSharedPlanUrl({
          version: 1,
          semesterKey,
          name: plan.name,
          courseIds: plan.courseIds,
        }, window.location.href),
        error: null,
      };
    } catch (error) {
      return {
        url: '',
        error: error instanceof Error ? error.message : '无法生成分享链接',
      };
    }
  }, [open, plan, semesterKey]);

  const canUseSystemShare = (
    typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
  );

  const copyLink = async () => {
    if (!linkState.url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(linkState.url);
      message.success('分享链接已复制');
    } catch {
      message.error('自动复制失败，请长按或选中链接手动复制');
    }
  };

  const systemShare = async () => {
    if (!linkState.url || !plan || !canUseSystemShare) return;
    try {
      await navigator.share({
        title: `选课方案：${plan.name}`,
        text: `${semesterName} · ${plan.courseIds.length} 个课堂`,
        url: linkState.url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      message.error('系统分享失败，请改用复制链接');
    }
  };

  return (
    <BottomModal
      className="share-plan-modal"
      title="分享当前方案"
      open={open}
      onClose={onClose}
      width={540}
      footer={(
        <>
          <Button onClick={onClose}>关闭</Button>
          {canUseSystemShare ? (
            <Button onClick={() => void systemShare()} disabled={!linkState.url}>
              系统分享
            </Button>
          ) : null}
          <Button type="primary" onClick={() => void copyLink()} disabled={!linkState.url}>
            复制链接
          </Button>
        </>
      )}
    >
      {plan ? (
        <div className="share-plan-modal__content">
          <dl className="share-plan-modal__summary">
            <div>
              <dt>方案</dt>
              <dd title={plan.name}>{plan.name}</dd>
            </div>
            <div>
              <dt>学期</dt>
              <dd title={semesterName}>{semesterName}</dd>
            </div>
            <div>
              <dt>课堂</dt>
              <dd>{plan.courseIds.length} 个</dd>
            </div>
          </dl>
          {linkState.error ? (
            <Alert type="error" showIcon message={linkState.error} />
          ) : (
            <Input.TextArea
              className="share-plan-modal__link"
              value={linkState.url}
              readOnly
              autoSize={{ minRows: 3, maxRows: 5 }}
              aria-label="方案分享链接"
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
          <p className="share-plan-modal__privacy">
            链接只包含当前方案的名称、学期和已选课堂。获得链接的人可以查看其中的方案名称和课堂信息。
          </p>
        </div>
      ) : null}
    </BottomModal>
  );
}
