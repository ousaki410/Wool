import type { WoolItem, SourceChannel } from './woolData';

/**
 * 来源事件类型。
 * - added:  新增条目进入列表
 * - updated: 已有条目的条件/奖励等发生变化
 * - expired: 条目过期（expiresAt 进入过去）
 * - source_failed: 某个情报源出错/延迟/维护
 * - source_recovered: 某个情报源恢复正常
 */
export type WoolSourceEventType =
  | 'added'
  | 'updated'
  | 'expired'
  | 'source_failed'
  | 'source_recovered';

export interface WoolSourceEvent {
  type: WoolSourceEventType;
  /** 受影响条目 id（added/updated/expired） */
  itemId?: string;
  /** 受影响来源 id（source_failed/source_recovered） */
  sourceId?: string;
  /** 条目最新快照（added/updated/expired 携带） */
  item?: WoolItem;
  timestamp: number;
}

/**
 * 数据源抽象。后续可替换为真实后端，目前只用于前端模拟。
 * 不接任何后端、不调用任何 AI 服务、不触碰密钥。
 */
export interface WoolSource {
  /** 返回当前快照（不含订阅关系） */
  list(): { items: WoolItem[]; channels: SourceChannel[] };
  /** 数据源自己的当前时间（ISO）；UI 的所有“当前时间”展示都应以此为准 */
  nowIso(): string;
  /**
   * 订阅来源事件，每次产生事件时回调。
   * 返回取消订阅函数。
   */
  subscribe(callback: (event: WoolSourceEvent) => void): () => void;
}
