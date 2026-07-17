import './AppDataState.css';

interface AppDataStateProps {
  phase: 'loading' | 'error';
  error: string | null;
}

/**
 * 课程数据加载/错误态的全屏占位。
 * 在 SemesterCatalogProvider 内、antd ConfigProvider 之外渲染，因此必须纯 HTML/CSS，
 * 不能依赖 antd 组件。样式走全局 tokens.css 变量，自动跟随主题。
 */
export default function AppDataState({ phase, error }: AppDataStateProps) {
  const isError = phase === 'error';
  return (
    <div
      className="app-data-state"
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
    >
      {!isError && <div className="app-data-state__spinner" aria-hidden="true" />}
      {isError ? (
        <>
          <p className="app-data-state__error">{error ?? '课程数据加载失败'}</p>
          <button
            type="button"
            className="app-data-state__retry"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </>
      ) : (
        <p className="app-data-state__hint">正在加载课程数据…</p>
      )}
    </div>
  );
}
