import { Empty } from 'antd';
import type { FavoriteKind } from '@/types';
import BottomModal from './BottomModal';
import { FavoriteButton } from './FavoriteButton';

export interface FavoriteManagerItem {
  kind: FavoriteKind;
  id: string;
  title: string;
  detail: string;
  planId?: string;
  groupKey?: string;
}

interface Props {
  open: boolean;
  items: FavoriteManagerItem[];
  onClose: () => void;
  onOpen: (item: FavoriteManagerItem) => void;
  onRemove: (item: FavoriteManagerItem) => void;
}

const GROUPS: { kind: FavoriteKind; title: string }[] = [
  { kind: 'plan', title: '选课方案' },
  { kind: 'arrangement', title: '排课方案' },
  { kind: 'timeGroup', title: '课程时间组' },
  { kind: 'section', title: '具体课堂' },
];

export default function FavoritesManagerModal({
  open,
  items,
  onClose,
  onOpen,
  onRemove,
}: Props) {
  return (
    <BottomModal open={open} title="收藏项目管理" onClose={onClose} width={760}>
      {items.length === 0 ? <Empty description="暂无收藏项目" /> : (
        <div className="favorites-manager">
          {GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.kind === group.kind);
            if (groupItems.length === 0) return null;
            return (
              <section className="favorites-manager__section" key={group.kind}>
                <h3 className="favorites-manager__heading">
                  {group.title}
                  <span className="favorites-manager__count">{groupItems.length}</span>
                </h3>
                <div className="favorites-manager__list">
                  {groupItems.map((item) => (
                    <div
                      className="favorites-manager__item"
                      key={`${item.kind}:${item.planId ?? ''}:${item.id}`}
                    >
                      <button
                        className="favorites-manager__copy"
                        type="button"
                        aria-label={`打开：${item.title}`}
                        onClick={() => onOpen(item)}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </button>
                      <FavoriteButton
                        active={true}
                        label={`取消收藏：${item.title}`}
                        onToggle={() => onRemove(item)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </BottomModal>
  );
}
