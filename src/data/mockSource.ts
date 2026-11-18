import type { SourceChannel, WoolItem } from './woolData';
import { ADDED_TEST_ITEMS } from './woolData.extra';
import type { WoolSource, WoolSourceEvent, WoolSourceEventType } from './source';
import { materializeSeedData } from './woolSeed';

// ---------------------------------------------------------------------------
// 简易可复现随机数（种子可设，测试不依赖真实随机）
// ---------------------------------------------------------------------------
export class SeededRng {
  private state: number;
  constructor(seed: number) {
    // xorshift32 种子必须非零
    this.state = seed || 1;
  }
  next(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state >>> 0) / 0xffffffff;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  bool(p: number): boolean {
    return this.next() < p;
  }
}

// ---------------------------------------------------------------------------
// MockSource 实现
// ---------------------------------------------------------------------------
export interface MockSourceOptions {
  seed?: number;
  /** 定时事件间隔（ms），默认 5 分钟，避免过密 */
  eventIntervalMs?: number;
  /**
   * 数据源时钟（ms），默认 Date.now。
   * 测试可注入固定时间，模拟不同的“加载时刻”。
   */
  clock?: () => number;
}

const ALL_EVENT_TYPES: WoolSourceEventType[] = [
  'added',
  'updated',
  'expired',
  'source_failed',
  'source_recovered',
];

export class MockSource implements WoolSource {
  private items: WoolItem[];
  private channels: SourceChannel[];
  private listeners = new Set<(event: WoolSourceEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private rng: SeededRng;
  private nextItemId = 100;
  private clock: () => number;
  private eventIntervalMs: number;

  // 标记本次会话已淡化的条目 id（新增/已更新标记在一段时间后或查看后淡化）
  private fadedItemIds = new Set<string>();
  // 标记本次会话已查看过的条目 id（用于“已更新”淡化）
  private viewedItemIds = new Set<string>();

  constructor(options: MockSourceOptions = {}) {
    this.rng = new SeededRng(options.seed ?? 42);
    this.clock = options.clock ?? Date.now;
    this.eventIntervalMs = options.eventIntervalMs ?? 5 * 60 * 1000;

    // 种子数据只保存相对偏移，在这里用数据源时钟一次性换算为 ISO 时间
    const seeded = materializeSeedData(this.now());
    this.items = seeded.items;
    this.channels = seeded.channels;
  }

  /** 数据源当前时间（ms） */
  private now(): number {
    return this.clock();
  }

  /** 数据源当前时间（ISO）；UI 的 nowIso 必须从这里获取 */
  nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  list(): { items: WoolItem[]; channels: SourceChannel[] } {
    return {
      items: [...this.items],
      channels: [...this.channels],
    };
  }

  subscribe(callback: (event: WoolSourceEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emit(type: WoolSourceEventType, item?: WoolItem, sourceId?: string) {
    const event: WoolSourceEvent = {
      type,
      itemId: item?.id,
      sourceId,
      item: item ? { ...item } : undefined,
      timestamp: this.now(),
    };
    this.listeners.forEach((cb) => cb(event));
  }

  /** 手动触发一次事件；可指定类型（默认随机），不受 pause 影响，便于随时演示 */
  trigger(type?: WoolSourceEventType): WoolSourceEventType {
    const nextType = type ?? this.rng.pick(ALL_EVENT_TYPES);
    this.applyEvent(nextType);
    return nextType;
  }

  private applyEvent(type: WoolSourceEventType) {
    switch (type) {
      case 'added': {
        const template = this.rng.pick(ADDED_TEST_ITEMS);
        const { expiresInHours, ...item } = template;
        const nowIso = new Date(this.now()).toISOString();
        const expiresAt = new Date(
          this.now() + expiresInHours * 60 * 60 * 1000
        ).toISOString();
        const next: WoolItem = {
          ...item,
          id: `WR-2026-N${this.nextItemId++}`,
          expiresAt,
          deadline: expiresAt,
          publishedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          isNew: true,
          isUpdated: false,
        };
        this.items.push(next);
        this.emit('added', next);
        break;
      }
      case 'updated': {
        const target = this.rng.pick(this.items.filter((i) => i.expiresAt));
        if (!target) return;
        const before = { ...target };
        // 修改条件或奖励，模拟来源内容变化
        if (target.condition) {
          target.condition = target.condition + '（已调整）';
        }
        if (target.reward) {
          target.reward = target.reward + ' · 已更新';
        }
        const nowIso = new Date(this.now()).toISOString();
        // 只更新 updatedAt，保留原始 publishedAt，避免“已更新”被误算成“24h 新增”
        target.updatedAt = nowIso;
        target.isUpdated = true;
        this.emit('updated', target, before.sourceId);
        break;
      }
      case 'expired': {
        // 选一条尚未过期且有截止时间的条目，设为过去时间
        const candidates = this.items.filter(
          (i) => i.expiresAt && new Date(i.expiresAt).getTime() > this.now()
        );
        const target = this.rng.pick(candidates);
        if (!target) return;
        // 过期：把 expiresAt 设为当前时间前 1 小时
        target.expiresAt = new Date(this.now() - 60 * 60 * 1000).toISOString();
        target.deadline = target.expiresAt;
        this.emit('expired', target);
        break;
      }
      case 'source_failed': {
        // 真实数据源不再跟踪运行状态，此处仅记录事件
        const ch = this.rng.pick(this.channels);
        if (!ch) return;
        this.emit('source_failed', undefined, ch.id);
        break;
      }
      case 'source_recovered': {
        const ch = this.rng.pick(this.channels);
        if (!ch) return;
        this.emit('source_recovered', undefined, ch.id);
        break;
      }
    }
  }

  /** 开始定时产生事件（默认每 5 分钟一次） */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.paused) {
        this.trigger();
      }
    }, this.eventIntervalMs);
    // 未引用定时器，允许进程退出
    if (this.timer.unref) this.timer.unref();
  }

  /** 停止定时事件产生 */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 暂停：不再产生定时事件，已有数据保持 */
  pause() {
    this.paused = true;
  }

  /** 继续：恢复定时事件产生 */
  resume() {
    this.paused = false;
  }

  isPaused() {
    return this.paused;
  }

  /** 将某条目标记为已查看，用于“已更新”标记淡化 */
  markViewed(itemId: string) {
    this.viewedItemIds.add(itemId);
  }

  /** 某条目的新增/已更新标记是否应当淡化 */
  isFaded(itemId: string): boolean {
    return this.fadedItemIds.has(itemId) || this.viewedItemIds.has(itemId);
  }

  /** 标记某条目为已淡化（例如过了一段时间后） */
  fade(itemId: string) {
    this.fadedItemIds.add(itemId);
  }
}

// 单例：App 内统一使用这一个数据源
export const mockSource = new MockSource();
