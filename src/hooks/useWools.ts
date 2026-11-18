import { useCallback, useEffect, useState } from 'react';
import type { SourceChannel, WoolItem } from '../data/woolData';
import type { WoolSourceEvent } from '../data/source';
import { mockSource } from '../data/mockSource';

/** “新增 / 已更新”标记的最长展示时间，超时自动淡化 */
export const FRESH_MARK_TTL_MS = 5 * 60 * 1000;

export interface FreshMarks {
  isNew: boolean;
  isUpdated: boolean;
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
  trigger: () => void;
  /** 查看条目后调用，淡化“新增 / 已更新”标记 */
  markViewed: (itemId: string) => void;
  /** 计算某条目当前应展示的新增/已更新标记 */
  getFreshMarks: (item: WoolItem) => FreshMarks;
}

/**
 * 唯一的数据入口：App 与组件都通过它取羊毛列表和来源状态。
 * - 订阅 MockSource 事件，事件产生后列表与来源状态同步刷新
 * - 每分钟只更新 nowIso，不重建列表，避免输入框失焦
 */
export function useWools(): UseWoolsResult {
  const [items, setItems] = useState<WoolItem[]>(() => mockSource.list().items);
  const [channels, setChannels] = useState<SourceChannel[]>(
    () => mockSource.list().channels
  );
  const [nowIso, setNowIso] = useState<string>(() => new Date().toISOString());
  const [events, setEvents] = useState<WoolSourceEvent[]>([]);
  const [paused, setPaused] = useState<boolean>(() => mockSource.isPaused());
  const [fadeVersion, setFadeVersion] = useState(0);

  // 订阅数据源事件：任何事件后刷新快照，保证列表与来源状态同步
  useEffect(() => {
    mockSource.start();

    const refresh = () => {
      const snapshot = mockSource.list();
      setItems(snapshot.items);
      setChannels(snapshot.channels);
    };

    const unsubscribe = mockSource.subscribe((event) => {
      refresh();
      setEvents((prev) => [...prev.slice(-49), event]);
    });

    // 订阅建立前的状态也补齐，避免错过首屏更新
    refresh();

    return () => {
      unsubscribe();
      // 单例数据源保持运行，切换 Tab 不重置模拟事件
    };
  }, []);

  // 每分钟刷新当前时间：只更新这一个状态，列表引用保持不变
  useEffect(() => {
    const timer = setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const pause = useCallback(() => {
    mockSource.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    mockSource.resume();
    setPaused(false);
  }, []);

  const trigger = useCallback(() => {
    mockSource.trigger();
  }, []);

  const markViewed = useCallback((itemId: string) => {
    mockSource.markViewed(itemId);
    setFadeVersion((v) => v + 1);
  }, []);

  const getFreshMarks = useCallback(
    (item: WoolItem): FreshMarks => {
      // 依赖 fadeVersion：查看后立即重新计算
      void fadeVersion;
      const referenceIso = item.updatedAt ?? item.publishedAt;
      const ageMs = Date.now() - new Date(referenceIso).getTime();
      const stillFresh = Number.isFinite(ageMs) && ageMs < FRESH_MARK_TTL_MS;
      const faded = mockSource.isFaded(item.id);
      return {
        isNew: Boolean(item.isNew) && stillFresh && !faded,
        isUpdated: Boolean(item.isUpdated) && stillFresh && !faded,
      };
    },
    [fadeVersion]
  );

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
  };
}
