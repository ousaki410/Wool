import type { SourceChannel, WoolItem } from './woolData';
import type { WoolSource, WoolSourceEvent, WoolSourceEventType } from './source';
import {
  isEvidenceRecord,
  type EvidenceJson,
  type EvidenceRecord,
} from './evidence';

const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';
const WOOL_JSON_URL = `${BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}/data/wool.json`;
const SOURCES_JSON_URL = `${BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}/data/sources.json`;
const EVIDENCE_JSON_URL = `${BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}/data/evidence.json`;

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
  const seed = it as Partial<WoolItem> & Record<string, unknown>;
  return {
    id: (seed.id as string) || `fli-${index}`,
    title: (seed.title as string) || '(无标题)',
    reward: (seed.reward as string) || '',
    estimatedValue: (seed.estimatedValue as string) || '¥0',
    estimatedValueRmb: typeof seed.estimatedValueRmb === 'number' ? seed.estimatedValueRmb : 0,
    condition: (seed.condition as string) || '',
    category: (seed.category as WoolItem['category']) || '开发工具与 SaaS',
    claimMethod: (seed.claimMethod as WoolItem['claimMethod']) || '直接领取',
    verificationStatus:
      (seed.verificationStatus as WoolItem['verificationStatus']) || '未核验',
    verificationNote: (seed.verificationNote as string) || '',
    expiresAt: (seed.expiresAt as string | null) ?? null,
    deadline: (seed.deadline as string | null) ?? null,
    publishedAt: (seed.publishedAt as string) || new Date().toISOString(),
    createdAt: (seed.createdAt as string) || undefined,
    updatedAt: (seed.updatedAt as string) || undefined,
    isNew: Boolean(seed.isNew),
    isUpdated: Boolean(seed.isUpdated),
    sourceId: (seed.sourceId as string) || 'src-fli-unknown',
    sourceName: (seed.sourceName as string) || '未知来源',
    sourceUrl: (seed.sourceUrl as string) || '',
    steps: Array.isArray(seed.steps)
      ? (seed.steps as string[]).filter((s) => typeof s === 'string')
      : [],
    riskNotes: (seed.riskNotes as string) || '',
    tags: Array.isArray(seed.tags) ? (seed.tags as string[]) : [],
    kind: (seed.kind as WoolItem['kind']) || undefined,
    hasOfficialLink: Boolean(seed.hasOfficialLink),
    deadlineHint: (seed.deadlineHint as string | undefined) || undefined,
    intelSource: (seed.intelSource as string | undefined) || undefined,
    linkText: (seed.linkText as string | undefined) || undefined,
  };
}

function buildChannels(sources: SourceInfo[]): SourceChannel[] {
  return sources.map((seed) => ({
    id: seed.id,
    name: seed.name,
    type: seed.type,
    url: seed.url,
    entryCount: seed.entryCount,
    lastFetchAt: seed.fetchedAt || null,
  }));
}

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
  private _sources: SourceInfo[] = [];

  /** 返回当前抓取状态快照。 */
  getStatus(): RealSourceStatus {
    return { ...this.status };
  }

  /** 来源列表（来自 sources.json）。 */
  get sources(): SourceInfo[] {
    return this._sources;
  }

  /**
   * 从 /data/wool.json 重新抓取。成功则替换列表并清除错误；失败则清空列表并记录错误。
   * sources.json 是可选的：读取失败只导致 channels 为空，wool.json 条目仍正常显示。
   * “最后抓取时间”取 wool.json 与 sources.json 中较新的一个。
   */
  async refresh(): Promise<void> {
    const prevOk = this.status.ok;

    try {
      // 1. 抓取 wool.json（必须）
      const woolRes = await fetch(WOOL_JSON_URL, { cache: 'no-store' });
      if (!woolRes.ok) throw new Error(`HTTP ${woolRes.status} ${woolRes.statusText}`);
      const woolData = (await woolRes.json()) as WoolJson;

      const rawItems = Array.isArray(woolData.items) ? woolData.items : [];
      const items = rawItems.filter(isWoolItem).map(normalizeItem);

      // 2. 抓取 sources.json（可选，失败不影响 wool 条目显示）
      let sources: SourceInfo[] = [];
      let sourcesFetchedAt: string | null = null;
      try {
        const sourcesRes = await fetch(SOURCES_JSON_URL, { cache: 'no-store' });
        if (sourcesRes.ok) {
          const sourcesData = (await sourcesRes.json()) as SourcesJson;
          sources = Array.isArray(sourcesData.sources)
            ? sourcesData.sources.filter(isSourceInfo)
            : [];
          sourcesFetchedAt = sourcesData.fetchedAt || null;
        }
      } catch {
        // sources.json 不可用，channels 保持空，wool 条目仍正常显示
        sources = [];
      }

      // 3. 抓取 evidence.json（可选，失败只导致卡片不显示存证）
      let evidenceRecords: EvidenceRecord[] = [];
      try {
        const evidenceRes = await fetch(EVIDENCE_JSON_URL, { cache: 'no-store' });
        if (evidenceRes.ok) {
          const evidenceData = (await evidenceRes.json()) as EvidenceJson;
          evidenceRecords = Array.isArray(evidenceData.records)
            ? evidenceData.records.filter(isEvidenceRecord)
            : [];
        }
      } catch {
        evidenceRecords = [];
      }
      const evidenceById = new Map(
        evidenceRecords.map((record) => [record.itemId, record])
      );
      this.items = items.map((item) => {
        const evidence = evidenceById.get(item.id);
        return evidence ? { ...item, evidence } : item;
      });

      this._sources = sources;
      this.channels = buildChannels(this._sources);

      // 最后抓取时间取 wool.json 和 sources.json 中最新的一个
      const woolFetchedAt = woolData.fetchedAt || null;
      const latestFetchAt = [woolFetchedAt, sourcesFetchedAt]
        .filter((v): v is string => v !== null)
        .sort()
        .pop() || null;

      this.status = {
        ok: true,
        lastSyncAt: woolFetchedAt || new Date().toISOString(),
        error: null,
        fetchedAt: latestFetchAt,
        count: this.items.length,
      };

      if (!prevOk) {
        this.emit('source_recovered', undefined, 'src-real');
      }
      this.emitItemsAdded();
    } catch (e) {
      // 抓取失败：不展示旧数据冒充新数据，清空列表，错误上报至 UI
      this.items = [];
      this._sources = [];
      this.channels = [];
      this.status = {
        ok: false,
        lastSyncAt: this.status.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
        fetchedAt: null,
        count: 0,
      };
      this.emit('source_failed', undefined, 'src-real');
    } finally {
      this.notifyListeners();
    }
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
