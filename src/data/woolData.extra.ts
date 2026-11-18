import type { WoolItem } from './woolData';

/**
 * 仅用于前端模拟“新增”事件的数据，与 25 条初始数据分开放置。
 * 不接后端、不调用任何 AI 服务、不包含任何密钥。
 */
export const ADDED_TEST_ITEMS: WoolItem[] = [
  {
    id: 'WR-2026-T1',
    title: '示例新增：云厂商算力券补货',
    reward: '¥50 云产品抵扣券',
    estimatedValue: '¥50',
    estimatedValueRmb: 50,
    condition: '完成实名认证的云服务新用户',
    category: '云服务与算力',
    claimMethod: '直接领取',
    verificationStatus: '未核验',
    verificationNote: '前端模拟事件生成，仅用于演示',
    expiresAt: '2026-12-31T23:59:59+08:00',
    deadline: '2026-12-31T23:59:59+08:00',
    publishedAt: '2026-11-17T14:00:00+08:00',
    sourceId: 'src-test',
    sourceName: '模拟来源',
    sourceUrl: 'https://example.test/',
    steps: ['打开模拟活动页', '点击领取并确认到账'],
    riskNotes: '仅用于前端演示，不指向真实活动。',
    tags: ['模拟数据', '算力券'],
  },
  {
    id: 'WR-2026-T2',
    title: '示例新增：订阅服务体验月卡',
    reward: '1 个月订阅体验',
    estimatedValue: '¥30',
    estimatedValueRmb: 30,
    condition: '从未订阅过该服务的账号',
    category: '数字会员与影音',
    claimMethod: '注册认证',
    verificationStatus: '社区线索',
    verificationNote: '前端模拟事件生成，仅用于演示',
    expiresAt: '2026-12-31T23:59:59+08:00',
    deadline: '2026-12-31T23:59:59+08:00',
    publishedAt: '2026-11-17T14:00:00+08:00',
    sourceId: 'src-test',
    sourceName: '模拟来源',
    sourceUrl: 'https://example.test/',
    steps: ['创建账号', '在账单页确认体验期'],
    riskNotes: '仅用于前端演示，不指向真实活动。',
    tags: ['模拟数据', '订阅'],
  },
];
