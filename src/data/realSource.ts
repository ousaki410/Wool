import type { SourceChannel, WoolItem } from './woolData';
import type { WoolSource, WoolSourceEvent, WoolSourceEventType } from './source';
import { formatShanghaiDateTime } from './shanghaiTime';

const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';
const WOOL_JSON_URL = `${BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}/data/wool.json`;
const SOURCES_JSON_URL = `${BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}/data/sources.json`;
const SOURCE_URL = 'https://free-llm-intel.aishort.top/';

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

export interface SourceInfo {
  id: string;
  name: string;
  type: string;
  url: string;
  entryCount: number;
  fetchedAt: string;
}

export interface SourcesJson {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  count: number;
  sources: SourceInfo[];
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

function isSourceInfo(value: unknown): value is SourceInfo {
  if (!value || typeof value !== 'object') return false;
  const it = value as Record<string, unknown>;
  return (
    typeof it.id === 'string' &&
    typeof it.name === 'string' &&
    typeof it.type === 'string' &&
    typeof it.url === 'string' &&
    typeof it.entryCount === 'number' &&
    (it.fetchedAt === null || typeof it.fetchedAt === 'string')
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
    hasOfficialLink: Boolean(src.hasOfficialLink),
    deadlineHint: (src.deadlineHint as string | undefined) || undefined,
    intelSource: (src.intelSource as string | undefined) || undefined,
    linkText: (src.linkText as string | undefined) || undefined,
  };
}

function buildChannels(sources: SourceInfo[], status: RealSourceStatus): SourceChannel[] {
  return sources.map((src) => ({
    id: src.id,
    name: src.name,
    type: src.type,
    url: src.url,
    entryCount: src.entryCount,
    lastFetchAt: src.fetchedAt || null,
  }));
}

function buildFailedChannels(status: RealSourceStatus): SourceChannel[] {
  return [];
}

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
      const [woolRes, sourcesRes] = await Promise.all([
        fetch(WOOL_JSON_URL, { cache: 'no-store' }),
        fetch(SOURCES_JSON_URL, { cache: 'no-store' }),
      ]);

      if (!woolRes.ok) throw new Error(`HTTP ${woolRes.status} ${woolRes.statusText}`);
      if (!sourcesRes.ok) throw new Error(`HTTP ${sourcesRes.status} ${sourcesRes.statusText}`);

      const woolData = (await woolRes.json()) as WoolJson;
      const sourcesData = (await sourcesRes.json()) as SourcesJson;

      const rawItems = Array.isArray(woolData.items) ? woolData.items : [];
      this.items = rawItems.filter(isWoolItem).map(normalizeItem);
      this.sources = Array.isArray(sourcesData.sources) ? sourcesData.sources.filter(isSourceInfo) : [];
      this.channels = buildChannels(this.sources, this.status);

      this.status = {
        ok: true,
        lastSyncAt: woolData.fetchedAt || new Date().toISOString(),
        error: null,
        fetchedAt: woolData.fetchedAt || new Date().toISOString(),
        count: this.items.length,
      };

      if (!prevOk) {
        this.emit('source_recovered', undefined, 'src-real');
      }
      this.emitItemsAdded();
    } catch (e) {
      // 抓取失败：不展示旧数据冒充新数据，清空列表，错误上报至 UI
      this.items = [];
      this.sources = [];
      this.channels = [];
      this.status = {
        ok: false,
        lastSyncAt: this.status.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
        fetchedAt: null,
        count: 0,
      };
      this.emit('source_failed', undefined, 'src-real');
    }
    this.notifyListeners();
  }

  /** 来源列表（来自 sources.json）。 */
  private _sources: SourceInfo[] = [];
  get sources(): SourceInfo[] {
    return this._sources;
  }
  set sources(value: SourceInfo[]) {
    this._sources = value;
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
