import type { SourceChannel, WoolItem } from './woolData';
import { ADDED_TEST_ITEMS } from './woolData.extra';
import type { WoolSource, WoolSourceEvent, WoolSourceEventType } from './source';

// ---------------------------------------------------------------------------
// 种子数据：保留现有 25 条 woolData 作为初始数据（过渡用，deadline 与 expiresAt 值一致）
// ---------------------------------------------------------------------------
export const SEED_WOOL_ITEMS: WoolItem[] = [
  {
    id: 'WR-2026-01',
    title: 'Anthropic 开发者计划 Build Tier 季末算力补贴',
    reward: '$150 Claude API 调用额度（有效期 90 天）',
    estimatedValue: '¥1,080',
    estimatedValueRmb: 1080,
    condition: '已完成 Tier 2 绑卡认证且过去 30 天有至少 $5 实际调用记录的开发者账号',
    category: 'AI 与大模型',
    claimMethod: '兑换码激活',
    verificationStatus: '官方已核验',
    verificationNote: '官方 Console 账单页实测可激活，额度即时到账',
    expiresAt: '2026-11-18T23:59:59+08:00',
    deadline: '2026-11-18T23:59:59+08:00',
    publishedAt: '2026-11-17T09:15:00+08:00',
    sourceId: 'src-anthropic',
    sourceName: 'Anthropic 开发者公告',
    sourceUrl: 'https://console.anthropic.com/settings/billing',
    promoCode: 'CLAUDE-BUILD-2026Q4',
    steps: [
      '登录 Anthropic Console 并进入 Settings -> Billing 页面',
      '在 Promo Credits 栏输入兑换码 CLAUDE-BUILD-2026Q4',
      '确认账户余额增加 $150，注意额度不抵扣月度固定席位费',
    ],
    riskNotes: '额度自激活起 90 天内有效，无需开启自动充值即可使用。',
    tags: ['Claude', 'API额度', '开发者福利'],
  },
  {
    id: 'WR-2026-02',
    title: '阿里云百炼大模型推理平台冬季开发者体验包',
    reward: '1,000 万 Tokens 通义千问 Max 推理额度 + ¥100 无门槛算力券',
    estimatedValue: '¥300',
    estimatedValueRmb: 300,
    condition: '完成阿里云个人或企业实名认证，且首次开通百炼推理服务',
    category: 'AI 与大模型',
    claimMethod: '直接领取',
    verificationStatus: '官方已核验',
    verificationNote: '阿里云官网活动页直达，实测个人支付宝实名秒领',
    expiresAt: '2026-11-30T23:59:59+08:00',
    deadline: '2026-11-30T23:59:59+08:00',
    publishedAt: '2026-11-17T08:40:00+08:00',
    sourceId: 'src-aliyun',
    sourceName: '阿里云官方活动中心',
    sourceUrl: 'https://bailian.console.aliyun.com/',
    steps: [
      '进入阿里云百炼控制台首页顶部“冬季开发者算力礼”横幅',
      '点击“一键开通并领取 1000 万免费 Tokens”',
      '前往费用中心 -> 卡券管理查看 ¥100 算力抵扣券',
    ],
    riskNotes: '免费额度耗尽后默认关闭后付费，建议在控制台开启额度预警短信。',
    tags: ['阿里云', '通义千问', 'Token包'],
  },
  {
    id: 'WR-2026-03',
    title: 'Cloudflare Workers & R2 独立开发者孵化赠金',
    reward: '$250 Workers Paid 与 R2 存储账单抵扣金（1 年有效）',
    estimatedValue: '¥1,800',
    estimatedValueRmb: 1800,
    condition: '拥有独立域名且 GitHub 账号存在至少 1 个公开全栈项目（Star ≥ 10）',
    category: '云服务与算力',
    claimMethod: '教育/开源资质',
    verificationStatus: '官方已核验',
    verificationNote: '通过 Cloudflare Launchpad 开源快速通道审核约需 24 小时',
    expiresAt: '2026-11-19T18:00:00+08:00',
    deadline: '2026-11-19T18:00:00+08:00',
    publishedAt: '2026-11-16T21:10:00+08:00',
    sourceId: 'src-cloudflare',
    sourceName: 'Cloudflare 开发者博客',
    sourceUrl: 'https://developers.cloudflare.com/workers/',
    steps: [
      '访问 Cloudflare 开源孵化申请页并关联 GitHub 账号',
      '填写项目仓库地址与 Cloudflare Account ID',
      '审核通过后邮件通知，账单页自动显示 $250 Credit',
    ],
    riskNotes: '本批次申请窗口将于 11 月 19 日下午 18:00 关闭。',
    tags: ['Cloudflare', 'R2存储', 'Serverless'],
  },
  {
    id: 'WR-2026-04',
    title: '云闪付 × 中国银联“冬日云端消费节”数字人民币红包',
    reward: '¥30 无门槛数字人民币立减金（支持京东/美团/电网缴费）',
    estimatedValue: '¥30',
    estimatedValueRmb: 30,
    condition: '云闪付实名用户且已开通任一运营机构数字人民币二类及以上钱包',
    category: '支付与银行卡券',
    claimMethod: '直接领取',
    verificationStatus: '官方已核验',
    verificationNote: '每日 10:00 补库存，今早实测工行/建行数币钱包均秒到',
    expiresAt: '2026-11-18T12:00:00+08:00',
    deadline: '2026-11-18T12:00:00+08:00',
    publishedAt: '2026-11-17T10:02:00+08:00',
    sourceId: 'src-unionpay',
    sourceName: '银联卡券监测站',
    sourceUrl: 'https://www.95516.com/',
    steps: [
      '打开云闪付 App 搜索“冬日云端数币礼”进入专题页',
      '选择已绑定的数字人民币运营机构（工行/招行/建行）点击领券',
      '在京东或网上国网支付时选择数字人民币钱包自动抵扣 ¥30',
    ],
    riskNotes: '红包到账后 7 天内有效，逾期自动收回。',
    tags: ['云闪付', '数字人民币', '无门槛立减'],
  },
  {
    id: 'WR-2026-05',
    title: 'JetBrains All Products Pack 开源维护者年度免费授权',
    reward: '12 个月 JetBrains 全家桶订阅（含 IntelliJ IDEA Ultimate / WebStorm / RustRover）',
    estimatedValue: '¥2,080',
    estimatedValueRmb: 2080,
    condition: '作为核心维护者参与开源项目满 3 个月，且项目近期有活跃 Commit 记录',
    category: '开发工具与 SaaS',
    claimMethod: '教育/开源资质',
    verificationStatus: '官方已核验',
    verificationNote: '官方长期支持计划，续期同样适用',
    expiresAt: null,
    deadline: null,
    publishedAt: '2026-11-15T14:20:00+08:00',
    sourceId: 'src-jetbrains',
    sourceName: 'JetBrains Open Source',
    sourceUrl: 'https://www.jetbrains.com/community/opensource/',
    steps: [
      '在开源仓库 README 或官网添加非商业性质说明',
      '登录 JetBrains 账号提交仓库地址与个人贡献链接',
      '通过邮件接收全产品包激活链接，支持多设备同时登录',
    ],
    riskNotes: '仅限非商业开源研发使用，严禁转售许可证。',
    tags: ['JetBrains', '开源福利', 'IDE'],
  },
  {
    id: 'WR-2026-06',
    title: 'Vercel Pro 团队版黑五前瞻 3 个月限免体验码',
    reward: '3 个月 Vercel Pro 订阅（价值 $60，含 1TB Fast Data Transfer）',
    estimatedValue: '¥430',
    estimatedValueRmb: 430,
    condition: '从未升级过 Pro 的个人 Hobby 账号，需绑定外币信用卡完成验证',
    category: '开发工具与 SaaS',
    claimMethod: '兑换码激活',
    verificationStatus: '社区线索',
    verificationNote: 'Linux.do 社区多起实测成功回报，部分虚拟卡可能被风控拒付',
    expiresAt: '2026-11-19T23:59:59+08:00',
    deadline: '2026-11-19T23:59:59+08:00',
    publishedAt: '2026-11-17T11:30:00+08:00',
    sourceId: 'src-linuxdo',
    sourceName: 'Linux.do 福利专区',
    sourceUrl: 'https://vercel.com/pricing',
    promoCode: 'SHIPIT-2026-PRO3M',
    steps: [
      '在 Vercel Dashboard 创建一个新的 Team 或选择现有 Hobby Team',
      '点击 Upgrade to Pro，在结账页面点击 Add promotional code',
      '输入 SHIPIT-2026-PRO3M，确认应付金额变为 $0.00 后提交',
    ],
    riskNotes: '极其重要：激活成功后立即前往 Billing 页面设置周期结束降级为 Hobby，防止第 4 个月自动扣费 $20。',
    tags: ['Vercel', '前端部署', '兑换码'],
  },
  {
    id: 'WR-2026-07',
    title: 'GitHub Student Developer Pack 高校学生综合权益包',
    reward: 'GitHub Copilot 免费使用 + DigitalOcean $200 额度 + Namecheap 免费域名',
    estimatedValue: '¥3,500',
    estimatedValueRmb: 3500,
    condition: '持有有效高校教育邮箱（.edu.cn / .edu）及学信网在线验证报告或学生证',
    category: '开发工具与 SaaS',
    claimMethod: '教育/开源资质',
    verificationStatus: '官方已核验',
    verificationNote: '官方教育计划长期有效，国内高校需开启校园网定位通过率更高',
    expiresAt: null,
    deadline: null,
    publishedAt: '2026-11-14T16:00:00+08:00',
    sourceId: 'src-github',
    sourceName: 'GitHub Education 官方',
    sourceUrl: 'https://education.github.com/pack',
    steps: [
      '在 GitHub 账号设置中添加并验证高校 .edu.cn 邮箱',
      '设置 Billing Profile 中的真实姓名与学生证英文拼音一致',
      '上传学生证或学信网验证截图，通过后自动解锁 Copilot 与合作厂商权益',
    ],
    riskNotes: '请勿使用购买的假教育邮箱，极易触发封号。',
    tags: ['GitHub', 'Copilot', '教育优惠'],
  },
  {
    id: 'WR-2026-08',
    title: '招商银行 App “M+ 会员日”哔哩哔哩大会员季卡 1 元购',
    reward: '哔哩哔哩大会员季卡（3 个月）直充到账',
    estimatedValue: '¥68',
    estimatedValueRmb: 68,
    condition: '招商银行 App M3 及以上等级用户，消耗 1 张黄金卡券 + ¥1 支付',
    category: '数字会员与影音',
    claimMethod: '任务达标',
    verificationStatus: '官方已核验',
    verificationNote: '招行 App 会员中心实测库存充足，手机号直充秒到',
    expiresAt: '2026-11-20T23:59:59+08:00',
    deadline: '2026-11-20T23:59:59+08:00',
    publishedAt: '2026-11-17T07:50:00+08:00',
    sourceId: 'src-cmb',
    sourceName: '招行卡券情报局',
    sourceUrl: 'https://www.cmbchina.com/',
    steps: [
      '打开招商银行 App -> 我的 -> M+ 会员中心',
      '在“视听娱乐特权”栏选择哔哩哔哩大会员季卡',
      '输入充值手机号并支付 ¥1 完成兑换',
    ],
    riskNotes: '每个自然月限兑 1 次，充值前请核对 B 站绑定手机号。',
    tags: ['招商银行', 'B站大会员', '影音会员'],
  },
  {
    id: 'WR-2026-09',
    title: 'Cursor AI 编辑器高校与科研人员半年 Pro 补贴线索',
    reward: '6 个月 Cursor Pro 订阅（每月 500 次 Fast Premium 请求）',
    estimatedValue: '¥860',
    estimatedValueRmb: 860,
    condition: '使用白名单内高校教育邮箱注册并提交研究方向简述',
    category: 'AI 与大模型',
    claimMethod: '教育/开源资质',
    verificationStatus: '社区线索',
    verificationNote: 'V2EX 网友反馈部分双一流高校 .edu.cn 可直接秒过，部分需人工审核',
    expiresAt: '2026-12-15T23:59:59+08:00',
    deadline: '2026-12-15T23:59:59+08:00',
    publishedAt: '2026-11-16T19:45:00+08:00',
    sourceId: 'src-v2ex',
    sourceName: 'V2EX 程序员节点',
    sourceUrl: 'https://www.cursor.com/',
    steps: [
      '使用学校后缀邮箱登录 Cursor 官网账户设置页',
      '进入教育折扣认证通道验证邮箱验证码',
      '认证通过后账单周期自动减免前 6 个月费用',
    ],
    riskNotes: '需绑定支持美元扣款的卡做 0 元预授权，记得提前取消自动续订。',
    tags: ['Cursor', 'AI编程', '教育优惠'],
  },
  {
    id: 'WR-2026-10',
    title: '腾讯云轻量应用服务器老用户免费升配 4GB 内存活动',
    reward: '现有 2C2G 轻量云实例免费升级至 2C4G（保持原续费价格不变）',
    estimatedValue: '¥240',
    estimatedValueRmb: 240,
    condition: '持有运行满 90 天的上海/广州/北京地域 2C2G 轻量应用服务器老用户',
    category: '云服务与算力',
    claimMethod: '直接领取',
    verificationStatus: '官方已核验',
    verificationNote: '腾讯云控制台站内信推送，实测重启实例后即完成升配',
    expiresAt: '2026-11-25T23:59:59+08:00',
    deadline: '2026-11-25T23:59:59+08:00',
    publishedAt: '2026-11-16T15:00:00+08:00',
    sourceId: 'src-tencent',
    sourceName: '腾讯云官方公告',
    sourceUrl: 'https://console.cloud.tencent.com/lighthouse',
    steps: [
      '登录腾讯云轻量应用服务器控制台查看实例列表旁“免费升配”标签',
      '勾选符合条件的 2C2G 实例并选择计划重启时间窗口',
      '实例自动重启约 2 分钟后内存即升级为 4GB',
    ],
    riskNotes: '升级过程需短暂重启实例，请避开业务高峰期操作。',
    tags: ['腾讯云', '轻量服务器', '免费升配'],
  },
  {
    id: 'WR-2026-11',
    title: 'OpenRouter 社区模型评测周 $15 免费路由测试金',
    reward: '$15 OpenRouter 通用 API 余额（可调用 DeepSeek / Claude / Llama 全系）',
    estimatedValue: '¥108',
    estimatedValueRmb: 108,
    condition: 'Discord 账号加入官方频道满 7 天并提交 3 组盲测对比评分',
    category: 'AI 与大模型',
    claimMethod: '受邀抽签',
    verificationStatus: '未核验',
    verificationNote: '海外社群流传问卷链接，尚未见到批量发放截图，谨防钓鱼授权',
    expiresAt: '2026-11-18T16:00:00+08:00',
    deadline: '2026-11-18T16:00:00+08:00',
    publishedAt: '2026-11-17T12:10:00+08:00',
    sourceId: 'src-reddit',
    sourceName: 'Reddit r/LocalLLaMA 线索',
    sourceUrl: 'https://openrouter.ai/',
    steps: [
      '通过 OpenRouter 官网顶部 Arena 入口参与 3 轮模型双盲对话投票',
      '在账户 Credits 页面查看是否触发评测奖励发放',
      '切勿在非 openrouter.ai 域名下输入现有 API Key',
    ],
    riskNotes: '未核验线索：请仅从官网导航进入，不要点击陌生私信中的 OAuth 链接。',
    tags: ['OpenRouter', '大模型评测', '待核验'],
  },
  {
    id: 'WR-2026-12',
    title: '京东 PLUS 会员年卡联合美团神券日 ¥50 现金返卡活动',
    reward: '开通 ¥99 京东 PLUS 年卡返 ¥50 超市卡 + 12 张美团 ¥5 膨胀神券',
    estimatedValue: '¥110',
    estimatedValueRmb: 110,
    condition: '当前非 PLUS 有效期内或距离到期不足 30 天的京东实名账号',
    category: '电商与生活福利',
    claimMethod: '任务达标',
    verificationStatus: '官方已核验',
    verificationNote: '京东 App PLUS 频道首页直达，超市卡开通后立即到账',
    expiresAt: '2026-11-22T23:59:59+08:00',
    deadline: '2026-11-22T23:59:59+08:00',
    publishedAt: '2026-11-16T11:20:00+08:00',
    sourceId: 'src-jd',
    sourceName: '京东会员中心',
    sourceUrl: 'https://plus.jd.com/',
    steps: [
      '打开京东 App 进入“PLUS 会员”中心确认显示“开通领 ¥50 超市卡”横幅',
      '完成支付后返回活动页点击“立即领取 ¥50 京东超市卡”',
      '在联名权益栏一键绑定美团手机号领取神券包',
    ],
    riskNotes: '部分气运值较低账号显示返 ¥30 红包，下单前请看清页面具体返卡面额。',
    tags: ['京东PLUS', '超市卡', '联名会员'],
  },
  {
    id: 'WR-2026-13',
    title: 'Supabase 初创与独立项目 $300 数据库抵扣额度',
    reward: '$300 Supabase Pro 计划账单抵扣金（有效期 6 个月）',
    estimatedValue: '¥2,160',
    estimatedValueRmb: 2160,
    condition: '新创建的 Supabase Organization 且关联 ProductHunt 或 GitHub 活跃项目',
    category: '云服务与算力',
    claimMethod: '注册认证',
    verificationStatus: '社区线索',
    verificationNote: '需通过合作伙伴表单提交，通常周五集中邮件批复',
    expiresAt: '2026-12-05T23:59:59+08:00',
    deadline: '2026-12-05T23:59:59+08:00',
    publishedAt: '2026-11-15T20:00:00+08:00',
    sourceId: 'src-linuxdo',
    sourceName: 'Linux.do 福利专区',
    sourceUrl: 'https://supabase.com/partners/integrations',
    steps: [
      '登录 Supabase 控制台复制 Organization Slug',
      '在合作伙伴初创支持页面填写产品简介与预计日活',
      '获批后在 Organization Billing 页面自动挂载 $300 Credits',
    ],
    riskNotes: '超出 Pro 基础套餐的额外计算实例（Compute Add-ons）同样可抵扣。',
    tags: ['Supabase', 'PostgreSQL', '云数据库'],
  },
  {
    id: 'WR-2026-14',
    title: 'Apple Music 中国区新老用户最高 3 个月免费听歌权益',
    reward: '新户 3 个月 / 老户回归 2 个月 Apple Music 个人订阅免费体验',
    estimatedValue: '¥33',
    estimatedValueRmb: 33,
    condition: '国区 Apple ID 且当前未处于 Apple Music 订阅生效状态',
    category: '数字会员与影音',
    claimMethod: '直接领取',
    verificationStatus: '官方已核验',
    verificationNote: 'Shazam 与支付宝双渠道合作页长期有效，老用户隔半年可再次领取',
    expiresAt: '2026-12-31T23:59:59+08:00',
    deadline: '2026-12-31T23:59:59+08:00',
    publishedAt: '2026-11-13T18:30:00+08:00',
    sourceId: 'src-apple',
    sourceName: 'Apple 官方合作活动',
    sourceUrl: 'https://www.apple.com.cn/apple-music/',
    steps: [
      '使用 iPhone Safari 打开 Apple Music 合作活动兑换页',
      '通过 Face ID 确认订阅（页面显示“前 2/3 个月免费，之后 ¥11/月”）',
      '立即进入系统“设置 -> Apple ID -> 订阅”取消续订，免费期依然保留至结束',
    ],
    riskNotes: '取消订阅后 Apple Music 仍可正常听满赠送周期，不会立即失效。',
    tags: ['Apple Music', '无损音乐', '免费订阅'],
  },
  {
    id: 'WR-2026-15',
    title: 'Google Cloud Vertex AI 新注册开发者 $300 + $100 额外推理赠金',
    reward: '$300 GCP 全产品通用赠金 + $100 Gemini API / Vertex AI 专项额度',
    estimatedValue: '¥2,880',
    estimatedValueRmb: 2880,
    condition: '从未开通过 Google Cloud 免费试用的 Google 账号，需支持外币实体卡验证',
    category: '云服务与算力',
    claimMethod: '注册认证',
    verificationStatus: '官方已核验',
    verificationNote: 'GCP 官方常驻迎新叠加 AI 开发者专项，实体 Visa/Mastercard 通过率高',
    expiresAt: null,
    deadline: null,
    publishedAt: '2026-11-12T10:00:00+08:00',
    sourceId: 'src-gcp',
    sourceName: 'Google Cloud 开发者中心',
    sourceUrl: 'https://cloud.google.com/free',
    steps: [
      '访问 Google Cloud Free Tier 页面点击 Start Free',
      '填写个人账单地址并绑定实体信用卡（仅做 $0/$1 预授权验证）',
      '进入 Vertex AI 控制台激活额外 $100 生成式 AI 试验额度',
    ],
    riskNotes: '试用期内除非手动点击“升级为付费账户”，否则赠金耗尽后自动停机不会扣款。',
    tags: ['GCP', 'Vertex AI', '云算力'],
  },
  {
    id: 'WR-2026-16',
    title: '工商银行“工享冬日”微信立减金抽签（保底 ¥16.8）',
    reward: '¥16.8 ~ ¥88 微信支付立减金券包（满 ¥20 可用）',
    estimatedValue: '¥18',
    estimatedValueRmb: 18,
    condition: '工行储蓄卡持卡人且近 30 天内有至少 3 笔微信渠道工行卡消费',
    category: '支付与银行卡券',
    claimMethod: '受邀抽签',
    verificationStatus: '社区线索',
    verificationNote: '部分地区分行受邀用户可见，深圳/上海/浙江地区实测命中率高',
    expiresAt: '2026-11-19T20:00:00+08:00',
    deadline: '2026-11-19T20:00:00+08:00',
    publishedAt: '2026-11-17T09:50:00+08:00',
    sourceId: 'src-unionpay',
    sourceName: '银联卡券监测站',
    sourceUrl: 'https://www.icbc.com.cn/',
    steps: [
      '打开中国工商银行 App -> 任务中心 -> 享活动',
      '查找“工享冬日消费达标礼”并点击抽取立减金',
      '授权跳转微信卡包领取到账',
    ],
    riskNotes: '若页面提示“非受邀客户”，则说明所在开户分行未纳入本次活动。',
    tags: ['工商银行', '微信立减金', '受邀活动'],
  },
  {
    id: 'WR-2026-17',
    title: '1Password Families 家庭版 1 年免费订阅（6 人共享）',
    reward: '12 个月 1Password 家庭版订阅（支持最多 5 位家庭成员邀请）',
    estimatedValue: '¥430',
    estimatedValueRmb: 430,
    condition: '从未注册过 1Password 的新邮箱账号，通过联名合作伙伴链接注册',
    category: '开发工具与 SaaS',
    claimMethod: '注册认证',
    verificationStatus: '官方已核验',
    verificationNote: '官方渠道合作促销链接有效，注册时可见 $0/First Year 提示',
    expiresAt: '2026-12-10T23:59:59+08:00',
    deadline: '2026-12-10T23:59:59+08:00',
    publishedAt: '2026-11-15T09:30:00+08:00',
    sourceId: 'src-v2ex',
    sourceName: 'V2EX 程序员节点',
    sourceUrl: 'https://1password.com/',
    steps: [
      '通过促销入口创建 1Password Families 账号并保存 Emergency Kit',
      '在 Billing 页面确认首年折扣已自动抵扣 $59.88',
      '在家庭成员管理页发送邀请链接给家人共享密码库',
    ],
    riskNotes: '首年到期前若不续费，账号将进入只读模式（可随时导出全部密码数据，不会丢失）。',
    tags: ['1Password', '密码管理', '家庭共享'],
  },
  {
    id: 'WR-2026-18',
    title: 'DeepSeek 开放平台新版本 API 体验金空投传闻',
    reward: '¥50 DeepSeek-V3 / R1 API 调用赠送余额',
    estimatedValue: '¥50',
    estimatedValueRmb: 50,
    condition: '2026 年 10 月前注册且完成手机号绑定的老开发者账户',
    category: 'AI 与大模型',
    claimMethod: '兑换码激活',
    verificationStatus: '未核验',
    verificationNote: '社群流传截图疑似旧版活动合成，官方后台暂未开启兑换码入口',
    expiresAt: '2026-11-21T23:59:59+08:00',
    deadline: '2026-11-21T23:59:59+08:00',
    publishedAt: '2026-11-17T13:05:00+08:00',
    sourceId: 'src-linuxdo',
    sourceName: 'Linux.do 福利专区',
    sourceUrl: 'https://platform.deepseek.com/',
    steps: [
      '登录 DeepSeek 开放平台查看“用量信息”页面是否有新增赠送余额',
      '目前官方并未发布公开兑换码，请勿轻信付费代领服务',
    ],
    riskNotes: '未核验预警：切勿向第三方机器人发送您的 DeepSeek API Key。',
    tags: ['DeepSeek', 'API赠金', '存疑线索'],
  },
  {
    id: 'WR-2026-19',
    title: 'Figma Professional 教育与自学者工作区永久免费认证',
    reward: 'Figma Professional 团队版全部功能（无限项目文件、共享组件库与 Dev Mode）',
    estimatedValue: '¥1,040',
    estimatedValueRmb: 1040,
    condition: '高校学生、教师或在线设计课程在读学员',
    category: '开发工具与 SaaS',
    claimMethod: '教育/开源资质',
    verificationStatus: '官方已核验',
    verificationNote: '官方 Education 通道长期开放，认证一次有效期 2 年',
    expiresAt: null,
    deadline: null,
    publishedAt: '2026-11-11T14:00:00+08:00',
    sourceId: 'src-github',
    sourceName: 'GitHub Education 官方',
    sourceUrl: 'https://www.figma.com/education/',
    steps: [
      '访问 Figma Education 页面点击 Get Verified',
      '选择高等教育或在线Bootcamp类别并填写课程/学校信息',
      '前往现有 Team 设置页点击 Upgrade，选择 Education Plan 即可 $0 升级',
    ],
    riskNotes: '支持直接使用已通过 GitHub Student Pack 认证的账号快速关联。',
    tags: ['Figma', 'UI设计', 'DevMode'],
  },
  {
    id: 'WR-2026-20',
    title: '瑞幸咖啡 × 浦发信用卡“周周享”¥9.9 双杯拿铁券包',
    reward: '2 张瑞幸全场通用 ¥29 面值饮品抵扣券（实付 ¥9.9 得 2 杯）',
    estimatedValue: '¥38',
    estimatedValueRmb: 38,
    condition: '浦发银行信用卡持卡人且本周有任意一笔 ≥ ¥18 消费',
    category: '电商与生活福利',
    claimMethod: '任务达标',
    verificationStatus: '官方已核验',
    verificationNote: '浦大喜奔 App 每周二 10:00 放券，今日名额剩余约 35%',
    expiresAt: '2026-11-17T23:59:59+08:00',
    deadline: '2026-11-17T23:59:59+08:00',
    publishedAt: '2026-11-17T10:15:00+08:00',
    sourceId: 'src-unionpay',
    sourceName: '银联卡券监测站',
    sourceUrl: 'https://ccc.spdb.com.cn/',
    steps: [
      '打开“浦大喜奔”App 搜索“周周瑞幸”进入活动专区',
      '点击达标资格核验并支付 ¥9.9 购买双杯券包',
      '券码自动同步至同手机号瑞幸咖啡小程序咖啡钱包',
    ],
    riskNotes: '今日（11 月 17 日）23:59 本批次抢购截止，券码到账后 15 天内有效。',
    tags: ['瑞幸咖啡', '浦发信用卡', '饮品券'],
  },
  {
    id: 'WR-2026-21',
    title: 'Notion Plus 携 Unlimited AI 创业孵化器 6 个月全免包',
    reward: '6 个月 Notion Plus 团队版 + Notion AI 无限量使用（最高价值 $3,000）',
    estimatedValue: '¥2,100',
    estimatedValueRmb: 2100,
    condition: '拥有独立企业域名邮箱且未申请过 Notion for Startups 的新工作区',
    category: '开发工具与 SaaS',
    claimMethod: '兑换码激活',
    verificationStatus: '社区线索',
    verificationNote: '需使用 AWS Activate 或 Stripe Atlas 合作伙伴代码提交申请',
    expiresAt: '2026-12-20T23:59:59+08:00',
    deadline: '2026-12-20T23:59:59+08:00',
    publishedAt: '2026-11-14T22:10:00+08:00',
    sourceId: 'src-v2ex',
    sourceName: 'V2EX 程序员节点',
    sourceUrl: 'https://www.notion.so/startups',
    promoCode: 'PARTNER-AWS-NOTION26',
    steps: [
      '使用自定义域名邮箱（非 Gmail/QQ）创建新的 Notion Workspace',
      '打开 Notion for Startups 申请表，Partner List 选择 AWS Activate 并填入代码',
      '通常 2~3 个工作日内收到 $3,000 额度批复邮件',
    ],
    riskNotes: '提交前请确保域名能够正常访问简单的产品 Landing Page，否则易被人工驳回。',
    tags: ['Notion', 'Notion AI', '初创扶持'],
  },
  {
    id: 'WR-2026-22',
    title: '中石化“易捷加油”双十一返场充 ¥200 送 ¥30 加油金（已结束）',
    reward: '¥20 汽油满减券 + ¥10 易捷便利店无门槛券',
    estimatedValue: '¥30',
    estimatedValueRmb: 30,
    condition: '易捷加油小程序实名绑卡用户',
    category: '电商与生活福利',
    claimMethod: '直接领取',
    verificationStatus: '官方已核验',
    verificationNote: '双十一返场周期已于 11 月 15 日晚截止',
    expiresAt: '2026-11-15T23:59:59+08:00',
    deadline: '2026-11-15T23:59:59+08:00',
    publishedAt: '2026-11-10T09:00:00+08:00',
    sourceId: 'src-jd',
    sourceName: '京东会员中心',
    sourceUrl: 'https://www.sinopecsales.com/',
    steps: [
      '活动已于 2026 年 11 月 15 日 23:59 结束',
      '已领券用户请在 11 月 30 日前到站核销',
    ],
    riskNotes: '本活动已过期，仅作历史存档参考。',
    tags: ['加油优惠', '中石化', '历史归档'],
  },
  {
    id: 'WR-2026-23',
    title: 'OpenAI Plus 订阅用户 Sora 视频生成 1,000 额外积分包（已过期）',
    reward: '1,000 Credits 1080p 视频生成加速积分',
    estimatedValue: '¥140',
    estimatedValueRmb: 140,
    condition: '2026 年 11 月 1 日前处于活跃状态的 ChatGPT Plus 订户',
    category: 'AI 与大模型',
    claimMethod: '直接领取',
    verificationStatus: '官方已核验',
    verificationNote: '周年限免申领窗口已于 11 月 12 日关闭',
    expiresAt: '2026-11-12T23:59:59+08:00',
    deadline: '2026-11-12T23:59:59+08:00',
    publishedAt: '2026-11-08T10:00:00+08:00',
    sourceId: 'src-anthropic',
    sourceName: 'Anthropic 开发者公告',
    sourceUrl: 'https://sora.com/',
    steps: [
      '登录 Sora 创作台查看右上角积分弹窗',
      '申领入口已于 11 月 12 日截止',
    ],
    riskNotes: '本活动已过期，未领取的额外积分不再补发。',
    tags: ['OpenAI', 'Sora', '历史归档'],
  },
  {
    id: 'WR-2026-24',
    title: 'DigitalOcean Hacktoberfest 2026 完赛 $100 云主机礼券（已过期）',
    reward: '$100 DigitalOcean Droplets 与 Kubernetes 60 天体验金',
    estimatedValue: '¥720',
    estimatedValueRmb: 720,
    condition: '在 10 月活动期间提交 4 个有效 Pull Request 的开发者',
    category: '云服务与算力',
    claimMethod: '兑换码激活',
    verificationStatus: '官方已核验',
    verificationNote: '完赛兑换码激活截止日为 11 月 14 日',
    expiresAt: '2026-11-14T23:59:59+08:00',
    deadline: '2026-11-14T23:59:59+08:00',
    publishedAt: '2026-11-05T16:00:00+08:00',
    sourceId: 'src-github',
    sourceName: 'GitHub Education 官方',
    sourceUrl: 'https://www.digitalocean.com/',
    promoCode: 'HACKTOBER-DO-2026',
    steps: ['兑换窗口已于 2026 年 11 月 14 日关闭'],
    riskNotes: '已过期归档条目。',
    tags: ['DigitalOcean', '开源活动', '历史归档'],
  },
  {
    id: 'WR-2026-25',
    title: 'PlayStation Plus 港服黑五预热 7 天全档位免费试用码（已过期）',
    reward: '7 天 PS Plus Deluxe 三档会员体验（含经典游戏目录与云试玩）',
    estimatedValue: '¥35',
    estimatedValueRmb: 35,
    condition: '港服 PSN 账号且当前无有效 PS Plus 会员',
    category: '数字会员与影音',
    claimMethod: '兑换码激活',
    verificationStatus: '社区线索',
    verificationNote: '限量 5,000 份体验码已于 11 月 13 日全部兑完',
    expiresAt: '2026-11-13T23:59:59+08:00',
    deadline: '2026-11-13T23:59:59+08:00',
    publishedAt: '2026-11-11T20:00:00+08:00',
    sourceId: 'src-reddit',
    sourceName: 'Reddit r/LocalLLaMA 线索',
    sourceUrl: 'https://store.playstation.com/zh-hant-hk/',
    steps: ['体验码配额已耗尽且活动已截止'],
    riskNotes: '已过期归档条目。',
    tags: ['PSN港服', '游戏会员', '历史归档'],
  },
];

export const SEED_SOURCE_CHANNELS: SourceChannel[] = [
  {
    id: 'src-anthropic',
    name: 'Anthropic 开发者公告',
    type: '官方公告',
    url: 'https://console.anthropic.com',
    status: '正常',
    lastSyncAt: '2026-11-17 13:55',
    intervalMinutes: 15,
    todayCount: 2,
    totalCount: 38,
    verifiedRate: 100,
    enabled: true,
    description: '监测 Claude API 官方账单促销、Build Tier 算力补贴与开发者赛事赠金。',
  },
  {
    id: 'src-aliyun',
    name: '阿里云官方活动中心',
    type: '官方公告',
    url: 'https://bailian.console.aliyun.com',
    status: '正常',
    lastSyncAt: '2026-11-17 13:50',
    intervalMinutes: 30,
    todayCount: 3,
    totalCount: 94,
    verifiedRate: 98,
    enabled: true,
    description: '追踪百炼大模型 Token 免费包、ECS 开发者试用与无门槛算力抵扣券。',
  },
  {
    id: 'src-cloudflare',
    name: 'Cloudflare 开发者博客',
    type: '官方公告',
    url: 'https://developers.cloudflare.com',
    status: '正常',
    lastSyncAt: '2026-11-17 13:42',
    intervalMinutes: 30,
    todayCount: 1,
    totalCount: 45,
    verifiedRate: 100,
    enabled: true,
    description: '同步 Workers、R2、Pages 独立开发者孵化计划与黑客松账单赠金。',
  },
  {
    id: 'src-linuxdo',
    name: 'Linux.do 福利专区',
    type: '技术社区',
    url: 'https://linux.do',
    status: '正常',
    lastSyncAt: '2026-11-17 13:58',
    intervalMinutes: 10,
    todayCount: 6,
    totalCount: 312,
    verifiedRate: 74,
    enabled: true,
    description: '高活跃度中文开发者羊毛社区，涵盖 SaaS 兑换码、API 额度与开源福利实测。',
  },
  {
    id: 'src-v2ex',
    name: 'V2EX 程序员节点',
    type: '技术社区',
    url: 'https://www.v2ex.com/go/programmer',
    status: '正常',
    lastSyncAt: '2026-11-17 13:48',
    intervalMinutes: 15,
    todayCount: 4,
    totalCount: 218,
    verifiedRate: 81,
    enabled: true,
    description: '聚合独立开发者工具折扣、教育邮箱认证技巧与云厂商隐藏促销线索。',
  },
  {
    id: 'src-unionpay',
    name: '银联卡券监测站',
    type: '金融卡券监测',
    url: 'https://www.95516.com',
    status: '正常',
    lastSyncAt: '2026-11-17 13:56',
    intervalMinutes: 10,
    todayCount: 5,
    totalCount: 420,
    verifiedRate: 92,
    enabled: true,
    description: '实时跟踪云闪付数字人民币红包、各大银行微信立减金与咖啡餐饮神券库存。',
  },
  {
    id: 'src-github',
    name: 'GitHub Education 官方',
    type: '开源与教育计划',
    url: 'https://education.github.com/pack',
    status: '正常',
    lastSyncAt: '2026-11-17 12:30',
    intervalMinutes: 60,
    todayCount: 1,
    totalCount: 67,
    verifiedRate: 100,
    enabled: true,
    description: '监控 GitHub 学生包新增合作厂商、JetBrains 与 Figma 开源/教育授权政策更新。',
  },
  {
    id: 'src-reddit',
    name: 'Reddit r/LocalLLaMA 线索',
    type: '聚合频道',
    url: 'https://www.reddit.com/r/LocalLLaMA',
    status: '延迟',
    lastSyncAt: '2026-11-17 11:15',
    intervalMinutes: 45,
    todayCount: 2,
    totalCount: 129,
    verifiedRate: 58,
    enabled: true,
    description: '海外 AI 算力与模型路由平台早期空投线索，时效快但需二次核验防钓鱼。',
  },
];

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
  /** 当前时间偏移（ms），便于测试模拟“过期”等时间相关事件 */
  nowOffsetMs?: number;
}

const ALL_EVENT_TYPES: WoolSourceEventType[] = [
  'added',
  'updated',
  'expired',
  'source_failed',
  'source_recovered',
];

const CHANNEL_STATUSES: SourceChannel['status'][] = ['正常', '延迟', '维护中'];

export class MockSource implements WoolSource {
  private items: WoolItem[];
  private channels: SourceChannel[];
  private listeners = new Set<(event: WoolSourceEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private rng: SeededRng;
  private nextItemId = 100;
  private nowOffsetMs: number;
  private eventIntervalMs: number;

  // 标记本次会话已淡化的条目 id（新增/已更新标记在一段时间后或查看后淡化）
  private fadedItemIds = new Set<string>();
  // 标记本次会话已查看过的条目 id（用于“已更新”淡化）
  private viewedItemIds = new Set<string>();

  constructor(options: MockSourceOptions = {}) {
    this.rng = new SeededRng(options.seed ?? 42);
    this.nowOffsetMs = options.nowOffsetMs ?? 0;
    this.eventIntervalMs = options.eventIntervalMs ?? 5 * 60 * 1000;
    // 深拷贝种子数据，避免外部篡改
    this.items = SEED_WOOL_ITEMS.map((i) => ({ ...i }));
    this.channels = SEED_SOURCE_CHANNELS.map((c) => ({ ...c }));
  }

  /** 当前模拟时间 */
  private now(): number {
    return Date.now() + this.nowOffsetMs;
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
        const item = this.rng.pick(ADDED_TEST_ITEMS);
        const nowIso = new Date(this.now()).toISOString();
        const next: WoolItem = {
          ...item,
          id: `WR-2026-N${this.nextItemId++}`,
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
        target.publishedAt = nowIso;
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
        const enabled = this.channels.filter((c) => c.enabled && c.status === '正常');
        const ch = this.rng.pick(enabled);
        if (!ch) return;
        ch.status = this.rng.pick(['延迟', '维护中']);
        ch.lastSyncAt = new Date(this.now()).toLocaleString('zh-CN', {
          hour12: false,
        });
        this.emit('source_failed', undefined, ch.id);
        break;
      }
      case 'source_recovered': {
        const faulty = this.channels.filter(
          (c) => c.enabled && c.status !== '正常'
        );
        const ch = this.rng.pick(faulty);
        if (!ch) return;
        ch.status = '正常';
        ch.lastSyncAt = new Date(this.now()).toLocaleString('zh-CN', {
          hour12: false,
        });
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

  /** 设置时间偏移，便于测试时间相关行为 */
  setNowOffsetMs(ms: number) {
    this.nowOffsetMs = ms;
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
