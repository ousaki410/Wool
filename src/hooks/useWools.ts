import { useCallback, useEffect, useState } from 'react';
import type { SourceChannel, WoolItem } from '../data/woolData';
import type { WoolSource, WoolSourceEvent } from '../data/source';
import { mockSource } from '../data/mockSource';
import { realSource } from '../data/realSource';

/** “新增 / 已更新”标记的最长展示时间，超时自动淡化 */
export const FRESH_MARK_TTL_MS = 5 * 60 * 1000;

export interface FreshMarks {
  isNew: boolean;
  isUpdated: boolean;
}

export type DataSourceKind = 'mock' | 'real';

export interface DataSourceStatus {
  kind: DataSourceKind;
  /** 当前生效的数据源名称 */
  name: string;
  /** 真实数据源的抓取状态（mock 模式下为 null） */
  real: ReturnType<typeof realSource.getStatus> | null;
  /** 正在加载真实数据 */
  loading: boolean;
}

export interface UseWoolsResult {
  items: WoolItem[];
  channels: SourceChannel[];
  /** 每分钟更新一次的当前时间（ISO），用于实时计算剩余天数与“即将到期” */
  nowIso: string;
  /** 最近收到的事件（最多保留 50 条） */
  events: WoolSourceEvent[];
  paused: boolean;
  pause: () => void;
  resume: () => void;
  /** 触发一次来源事件；真实数据源下等价于重新抓取 wool.json */
  trigger: () => void;
  /** 查看条目后调用，淡化“新增 / 已更新”标记 */
  markViewed: (itemId: string) => void;
  /** 计算某条目当前应展示的新增/已更新标记 */
  getFreshMarks: (item: WoolItem) => FreshMarks;
  /** 当前生效的数据源类型与状态 */
  source: DataSourceStatus;
}

/**
 * 唯一的数据入口：App 与组件都通过它取羊毛列表和来源状态。
 *
 * 数据源开关（localStorage `woolradar_data_source`，值为 `mock` 或 `real`）：
 * - 默认使用真实数据源 realSource，运行时读取 /data/wool.json
 * - 可切回 mockSource 用于演示或离线场景
 *
 * 真实数据源加载为异步：首屏会短暂 loading，抓取失败时清空列表并上报错误，
 * 不展示旧数据冒充新数据。
 */
export function useWools(): UseWoolsResult {
  const [items, setItems] = useState<WoolItem[]>([]);
  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [nowIso, setNowIso] = useState<string>(() => new Date().toISOString());
  const [events, setEvents] = useState<WoolSourceEvent[]>([]);
  const [paused, setPaused] = useState<boolean>(false);
  const [fadeVersion, setFadeVersion] = useState(0);
  const [sourceKind, setSourceKind] = useState<DataSourceKind>(() => {
    try {
      const saved = localStorage.getItem('woolradar_data_source');
      if (saved === 'mock' || saved === 'real') return saved;
    } catch {
      // ignore
    }
    return 'real';
  });
  const [loading, setLoading] = useState<boolean>(sourceKind === 'real');

  const activeSource: WoolSource = sourceKind === 'real' ? realSource : mockSource;

  // 读取真实数据源当前状态，供 UI 展示“数据来源 / 最后更新时间 / 失败原因”
  const [realStatus, setRealStatus] = useState<ReturnType<typeof realSource.getStatus> | null>(
    null
  );

  const sourceName = sourceKind === 'real' ? 'free-llm-intel 公开订阅' : '本地模拟数据';

  // 初始化：真实数据源需要先抓取；模拟数据源直接就绪
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(sourceKind === 'real');
      if (sourceKind === 'real') {
        await realSource.refresh();
        if (!cancelled) {
          setItems(realSource.list().items);
          setChannels(realSource.list().channels);
          setRealStatus(realSource.getStatus());
          setLoading(false);
        }
      } else {
        const snapshot = mockSource.list();
        if (!cancelled) {
          setItems(snapshot.items);
          setChannels(snapshot.channels);
          setRealStatus(null);
          setLoading(false);
        }
        mockSource.start();
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [sourceKind]);

  // 订阅当前数据源事件：任何事件后刷新快照，保证列表与来源状态同步
  useEffect(() => {
    const refresh = () => {
      const snapshot = activeSource.list();
      setItems(snapshot.items);
      setChannels(snapshot.channels);
      if (sourceKind === 'real') {
        setRealStatus(realSource.getStatus());
      }
    };

    const unsubscribe = activeSource.subscribe((event: WoolSourceEvent) => {
      refresh();
      setEvents((prev) => [...prev.slice(-49), event]);
    });

    refresh();

    // 每分钟刷新当前时间：只更新这一个状态，列表引用保持不变
    const timer = setInterval(() => {
      setNowIso(activeSource.nowIso());
    }, 60_000);

    // 真实数据源下，每 5 分钟自动重抓取一次（不受模拟 paused 影响，由数据源本身控制频率）
    const refetchTimer = setInterval(() => {
      if (sourceKind === 'real' && !paused) {
        realSource.refresh().then(() => {
          if (sourceKind !== 'real') return;
          const snapshot = realSource.list();
          setItems(snapshot.items);
          setChannels(snapshot.channels);
          setRealStatus(realSource.getStatus());
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
      clearInterval(refetchTimer);
      // 单例数据源保持运行，切换 Tab 不重置模拟事件
    };
  }, [sourceKind, activeSource, paused]);

  const pause = useCallback(() => {
    setPaused(true);
    mockSource.pause();
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    mockSource.resume();
  }, []);

  const trigger = useCallback(() => {
    if (sourceKind === 'real') {
      realSource.refresh().then(() => {
        const snapshot = realSource.list();
        setItems(snapshot.items);
        setChannels(snapshot.channels);
        setRealStatus(realSource.getStatus());
      });
    } else {
      mockSource.trigger();
    }
  }, [sourceKind]);

  const markViewed = useCallback((itemId: string) => {
    if (sourceKind === 'mock') {
      mockSource.markViewed(itemId);
    }
    setFadeVersion((v) => v + 1);
  }, [sourceKind]);

  const getFreshMarks = useCallback(
    (item: WoolItem): FreshMarks => {
      // 依赖 fadeVersion：查看后立即重新计算
      void fadeVersion;
      const referenceIso = item.updatedAt ?? item.publishedAt;
      const ageMs = Date.parse(activeSource.nowIso()) - new Date(referenceIso).getTime();
      const stillFresh = Number.isFinite(ageMs) && ageMs < FRESH_MARK_TTL_MS;
      const faded = sourceKind === 'mock' ? mockSource.isFaded(item.id) : false;
      return {
        isNew: Boolean(item.isNew) && stillFresh && !faded,
        isUpdated: Boolean(item.isUpdated) && stillFresh && !faded,
      };
    },
    [fadeVersion, sourceKind, activeSource]
  );

  const source: DataSourceStatus = {
    kind: sourceKind,
    name: sourceName,
    real: realStatus,
    loading,
  };

  return {
    items,
    channels,
    nowIso,
    events,
    paused,
    pause,
    resume,
    trigger,
    markViewed,
    getFreshMarks,
    source,
  };
}
