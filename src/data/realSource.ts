import type { SourceChannel, WoolItem } from './woolData';
import type { WoolSource, WoolSourceEvent, WoolSourceEventType } from './source';
import { formatShanghaiDateTime } from './shanghaiTime';

const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';
const WOOL_JSON_URL = `${BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}/data/wool.json`;

export interface RealSourceStatus {
  /** 上一次抓取是否成功 */
  ok: boolean;
  /** 上一次成功抓取的时间（ISO），失败时保留上次成功时间 */
  lastSyncAt: string | null;
  /** 最近一次抓取错误信息，成功时为 null */
  error: string | null;
  /** 本次抓取完成的时间（ISO），失败时为 null */
  fetchedAt: string | null;
  /** 条目数 */
  count: number;
}

export interface WoolJson {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  count: number;
  items: WoolItem[];
}

function isWoolItem(value: unknown): value is WoolItem {
  if (!value || typeof value !== 'object') return false;
  const it = value as Record<string, unknown>;
  return (
    typeof it.id === 'string' &&
    typeof it.title === 'string' &&
    typeof it.sourceId === 'string' &&
    typeof it.sourceName === 'string'
  );
}

function normalizeItem(it: unknown, index: number): WoolItem {
  const src = it as Partial<WoolItem> & Record<string, unknown>;
  return {
    id: (src.id as string) || `fli-${index}`,
    title: (src.title as string) || '(无标题)',
    reward: (src.reward as string) || '',
    estimatedValue: (src.estimatedValue as string) || '¥0',
    estimatedValueRmb: typeof src.estimatedValueRmb === 'number' ? src.estimatedValueRmb : 0,
    condition: (src.condition as string) || '',
    category: (src.category as WoolItem['category']) || '开发工具与 SaaS',
    claimMethod: (src.claimMethod as WoolItem['claimMethod']) || '直接领取',
    verificationStatus:
      (src.verificationStatus as WoolItem['verificationStatus']) || '未核验',
    verificationNote: (src.verificationNote as string) || '',
    expiresAt: (src.expiresAt as string | null) ?? null,
    deadline: (src.deadline as string | null) ?? null,
    publishedAt: (src.publishedAt as string) || new Date().toISOString(),
    createdAt: (src.createdAt as string) || undefined,
    updatedAt: (src.updatedAt as string) || undefined,
    isNew: Boolean(src.isNew),
    isUpdated: Boolean(src.isUpdated),
    sourceId: (src.sourceId as string) || 'src-fli-unknown',
    sourceName: (src.sourceName as string) || '未知来源',
    sourceUrl: (src.sourceUrl as string) || '',
    steps: Array.isArray(src.steps) ? (src.steps as string[]).filter((s) => typeof s === 'string') : [],
    riskNotes: (src.riskNotes as string) || '',
    tags: Array.isArray(src.tags) ? (src.tags as string[]) : [],
    kind: (src.kind as WoolItem['kind']) || undefined,
  };
}

function buildChannel(items: WoolItem[], status: RealSourceStatus): SourceChannel[] {
  const names = new Set<string>();
  for (const it of items) names.add(it.sourceName);
  const channelNames = Array.from(names);

  return channelNames.map((name) => ({
    id: `src-real-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type: '聚合频道' as const,
    url: SOURCE_URL,
    status: status.ok ? ('正常' as const) : ('延迟' as const),
    lastSyncAt: status.lastSyncAt || status.fetchedAt || '',
    intervalMinutes: 1440,
    todayCount: status.ok ? items.length : 0,
    totalCount: status.ok ? items.length : 0,
    verifiedRate: 0,
    enabled: true,
    description:
      '来自 free-llm-intel 公开 RSS 订阅，条目核验状态均为“未核验”，不自动生成兑换码。',
  }));
}

function buildFailedChannel(status: RealSourceStatus): SourceChannel[] {
  return [
    {
      id: 'src-real-free-llm-intel',
      name: 'free-llm-intel 公开订阅',
      type: '聚合频道',
      url: SOURCE_URL,
      status: '延迟',
      lastSyncAt: status.lastSyncAt || '',
      intervalMinutes: 1440,
      todayCount: 0,
      totalCount: 0,
      verifiedRate: 0,
      enabled: true,
      description: `抓取失败：${status.error || '未知错误'}。已清空列表，不展示旧数据冒充新数据。`,
    },
  ];
}

const SOURCE_URL = 'https://free-llm-intel.aishort.top/';

/**
 * 真实数据源：运行时读取 public/data/wool.json（由 scripts/fetch-source.ts 生成并通过 Actions 发布）。
 * 与 mockSource 并存，通过 useWools 中的开关切换。默认使用真实数据。
 */
export class RealSource implements WoolSource {
  private items: WoolItem[] = [];
  private channels: SourceChannel[] = [];
  private listeners = new Set<(event: WoolSourceEvent) => void>();
  private status: RealSourceStatus = {
    ok: false,
    lastSyncAt: null,
    error: '尚未抓取',
    fetchedAt: null,
    count: 0,
  };

  /** 上一次抓取状态。 */
  getStatus(): RealSourceStatus {
    return { ...this.status };
  }

  /** 从 /data/wool.json 重新抓取。成功则替换列表并清除错误；失败则清空列表并记录错误。 */
  async refresh(): Promise<void> {
    const prevOk = this.status.ok;
    try {
      const res = await fetch(WOOL_JSON_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = (await res.json()) as WoolJson;
      const rawItems = Array.isArray(data.items) ? data.items : [];
      this.items = rawItems.filter(isWoolItem).map(normalizeItem);
      this.status = {
        ok: true,
        lastSyncAt: data.fetchedAt || new Date().toISOString(),
        error: null,
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        count: this.items.length,
      };
      this.channels = buildChannel(this.items, this.status);

      if (!prevOk) {
        this.emit('source_recovered', undefined, 'src-real');
      }
      this.emitItemsAdded();
    } catch (e) {
      // 抓取失败：不展示旧数据冒充新数据，清空列表，错误上报至 UI
      this.items = [];
      this.status = {
        ok: false,
        lastSyncAt: this.status.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
        fetchedAt: null,
        count: 0,
      };
      this.channels = buildFailedChannel(this.status);
      this.emit('source_failed', undefined, 'src-real');
    }
    this.notifyListeners();
  }

  list(): { items: WoolItem[]; channels: SourceChannel[] } {
    return { items: [...this.items], channels: [...this.channels] };
  }

  nowIso(): string {
    return new Date().toISOString();
  }

  subscribe(callback: (event: WoolSourceEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emit(type: WoolSourceEventType, item?: WoolItem, sourceId?: string): void {
    const event: WoolSourceEvent = {
      type,
      itemId: item?.id,
      sourceId,
      item: item ? { ...item } : undefined,
      timestamp: Date.now(),
    };
    this.listeners.forEach((cb) => cb(event));
  }

  private emitItemsAdded(): void {
    for (const it of this.items) {
      this.emit('added', { ...it, isNew: true }, it.sourceId);
    }
  }

  private notifyListeners(): void {
    // 状态变更本身不产生条目事件，供 useWools 轮询 getStatus() 读取
  }
}

// 单例：App 内统一使用这一个真实数据源
export const realSource = new RealSource();
