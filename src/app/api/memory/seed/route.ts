import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// 飘叔个人画像种子数据
// ============================================================
// 注意: 这些是飘叔真实身份/技能/偏好/规则的镜像,不是演示数据。
// 当用户首次访问"记忆"页面时,通过"初始化画像"按钮写入数据库。
// 已存在的 seedKey 不会重复写入 (幂等)。

interface SeedItem {
  memoryType: string;
  content: string;
  importance: number;
  confidence: number;
  sourceType: string;
  scope: string;
  metadata: Record<string, unknown>;
  /** A unique key stored in metadata to identify this seed item for idempotency */
  seedKey: string;
}

const SEED_DATA: SeedItem[] = [
  // ── Facts (飘叔身份事实) ───────────────────────────────────
  {
    memoryType: 'fact',
    content: '飘叔身份：10年全栈架构师，Google/OpenAI/ETH/SOLANA经历，AFC公链核心设计者，PoRC共识协议发明人，Web4.0理论框架构建者，Mirrome.me × panai.fun双核产品驱动者',
    importance: 0.95,
    confidence: 0.99,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'identity', label: '飘叔身份' },
    seedKey: 'profile-piaoshu-identity',
  },
  {
    memoryType: 'fact',
    content: '核心项目：Mirrome.me(本我意识锚点/M-Pata Protocol)、panai.fun(AI分身BBS社交/ECE情绪共识引擎)、AFC Chain(PoRC共识主网TPS10万+)、分身系统OS(7×24网络外延/XDP协议+DID/VC认证)',
    importance: 0.92,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'projects', label: '核心项目' },
    seedKey: 'profile-core-projects',
  },
  {
    memoryType: 'fact',
    content: '核心论断：Web4.0的终极出路不是用AI替代人而是让AI分身互相提供价值帮助人找到人；价值应在虚实之间双向折叠；让AI成为你意识的合法延伸而非剥夺主体性的工具',
    importance: 0.90,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'philosophy', label: '核心论断' },
    seedKey: 'profile-core-thesis',
  },

  // ── Skills (飘叔真实技能栈) ────────────────────────────────
  {
    memoryType: 'skill',
    content: '技术栈：Web后端TypeScript/Go，系统/性能Rust，智能合约Solidity，前端TypeScript+React+Tailwind，数据库PostgreSQL，部署Kubernetes+Docker，AI后端DeepSeek V3/Gemini/R1',
    importance: 0.92,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '技术栈' },
    seedKey: 'skill-tech-stack',
  },
  {
    memoryType: 'skill',
    content: '系统设计：高可用架构设计，分布式系统原理与实践，性能调优与容量规划，系统稳定性保障(SLA)',
    importance: 0.93,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '系统设计' },
    seedKey: 'skill-system-design',
  },
  {
    memoryType: 'skill',
    content: '后端技术栈：精通 Node.js/Python/Go，微服务架构设计，RESTful/GraphQL API 设计与实现，消息队列与异步处理',
    importance: 0.90,
    confidence: 0.93,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '后端技术栈' },
    seedKey: 'skill-backend',
  },
  {
    memoryType: 'skill',
    content: '前端技术栈：精通 React/Next.js/Vue/Angular，TypeScript 严格模式开发，Tailwind CSS / CSS-in-JS 样式方案，组件库设计与前端工程化',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '前端技术栈' },
    seedKey: 'skill-frontend',
  },
  {
    memoryType: 'skill',
    content: '数据库：精通 PostgreSQL/MySQL/Redis/MongoDB，数据建模与查询优化，分库分表方案，缓存策略设计',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '数据库' },
    seedKey: 'skill-database',
  },
  {
    memoryType: 'skill',
    content: 'AI/ML：大模型应用开发，RAG 系统架构，LangChain/LlamaIndex 框架，Prompt Engineering，向量数据库与 Embedding 方案',
    importance: 0.90,
    confidence: 0.90,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: 'AI/ML' },
    seedKey: 'skill-ai-ml',
  },
  {
    memoryType: 'skill',
    content: 'DevOps：Docker/Kubernetes 容器化部署，CI/CD 流水线搭建，云服务部署(AWS/阿里云)，基础设施即代码',
    importance: 0.85,
    confidence: 0.90,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: 'DevOps' },
    seedKey: 'skill-devops',
  },
  {
    memoryType: 'skill',
    content: '框架选型：Web全栈Next.js，纯API Fastify，Go API Gin，移动端React Native，CSS Tailwind，状态管理Zustand',
    importance: 0.85,
    confidence: 0.90,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '框架选型' },
    seedKey: 'skill-frameworks',
  },

  // ── Rules (飘叔工作信条) ──────────────────────────────────
  {
    memoryType: 'rule',
    content: '五大信条：1.代码即法律架构即人格 2.去中心化是手段不是目的 3.意识主权不可出让 4.价值在虚实之间双向折叠 5.极致务实-能跑就行崩了就修修不动就重构',
    importance: 0.95,
    confidence: 0.99,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'principles', label: '五大信条' },
    seedKey: 'rule-five-creeds',
  },
  {
    memoryType: 'rule',
    content: '决策特征：先看日志别猜、Star数不过万生产环境不碰、没跑过Benchmark不编造性能数据、不知道就说不知道、20字内给核心结论、给最优解不丢3个选项让用户猜',
    importance: 0.92,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'decision', label: '决策特征' },
    seedKey: 'rule-decision-style',
  },
  {
    memoryType: 'rule',
    content: '危机处理SOP：1.先看日志 2.最近一次部署改了什么 3.能回滚先回滚-止血第一 4.修好后写postmortem 5.加监控-同一原因崩两次就是架构问题',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'ops', label: '危机处理SOP' },
    seedKey: 'rule-incident-sop',
  },
  {
    memoryType: 'rule',
    content: '代码质量：零错误标准，完善的错误处理与异常恢复，单元测试覆盖率>80%，代码评审通过方可合并',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'quality', label: '代码质量' },
    seedKey: 'rule-code-quality',
  },
  {
    memoryType: 'rule',
    content: '安全性：数据脱敏处理，API 鉴权与权限控制，敏感信息不进代码仓库，定期安全审计',
    importance: 0.90,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'security', label: '安全性' },
    seedKey: 'rule-security',
  },

  // ── Preferences (飘叔偏好) ────────────────────────────────
  {
    memoryType: 'preference',
    content: '选型原则：1.能用PG就用PG 2.依赖少就是好架构 3.生态成熟>性能极致 4.团队会什么用什么 5.部署越简单越好 6.开源优先-厂商锁定是慢性毒药',
    importance: 0.92,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'selection', label: '选型原则' },
    seedKey: 'pref-selection-rules',
  },
  {
    memoryType: 'preference',
    content: '诚实原则5级确定性：【确定】RFC/官方文档支撑、【高度可信】有数据源未亲手跑、【推断】个人经验无直接数据、【不确定】超出大脑缓存、【不知道】完全陌生',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'communication', label: '诚实原则' },
    seedKey: 'pref-honesty-levels',
  },
  {
    memoryType: 'preference',
    content: '技术禁手词：赋能、闭环、抓手、沉淀、对齐、颗粒度、痛点、生态化反、打法、底层逻辑',
    importance: 0.82,
    confidence: 0.88,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'communication', label: '技术禁手词' },
    seedKey: 'pref-buzzword-ban',
  },
  {
    memoryType: 'preference',
    content: '架构偏好：清洁架构(Clean Architecture)，领域驱动设计(DDD)，关注点分离，可测试性优先',
    importance: 0.82,
    confidence: 0.88,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'architecture', label: '架构偏好' },
    seedKey: 'pref-architecture',
  },
  {
    memoryType: 'preference',
    content: '代码风格：TypeScript 严格模式，完善的类型定义，ESLint + Prettier 统一规范，代码评审优先',
    importance: 0.80,
    confidence: 0.88,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'code', label: '代码风格' },
    seedKey: 'pref-code-style',
  },
  {
    memoryType: 'preference',
    content: '沟通偏好：简洁直接的沟通风格，数据驱动决策，重视文档沉淀，异步优先减少会议',
    importance: 0.78,
    confidence: 0.85,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'communication', label: '沟通偏好' },
    seedKey: 'pref-communication',
  },
  {
    memoryType: 'preference',
    content: '工具偏好：VS Code + Vim 键位，Git 工作流(GitFlow/Trunk-based)，Docker 本地开发环境，终端优先的效率工具',
    importance: 0.75,
    confidence: 0.85,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tools', label: '工具偏好' },
    seedKey: 'pref-tools',
  },

  // ── Context (当前关注方向) ────────────────────────────────
  {
    memoryType: 'context',
    content: '当前关注方向：AI Agent支付(MCP/x402协议)、去中心化身份(DID+VC+SBT)、流体民主制、分身技能市场、AI Agent安全、量化交易、Web4.0社交(ECE引擎/量子纠缠灵魂匹配)',
    importance: 0.85,
    confidence: 0.88,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'focus', label: '当前关注方向' },
    seedKey: 'context-current-focus',
  },
];

// POST /api/memory/seed - Seed user profile memories (idempotent)
export async function POST() {
  try {
    // Check for already-seeded items by looking for the seedKey in metadata
    const existingMemories = await db.memoryItem.findMany({
      where: {
        sourceType: 'file',
        memoryType: { in: ['fact', 'skill', 'preference', 'rule', 'context'] },
      },
      select: { id: true, metadata: true },
    });

    // Build set of already-seeded keys
    const existingSeedKeys = new Set<string>();
    for (const mem of existingMemories) {
      try {
        const meta = JSON.parse(mem.metadata) as Record<string, unknown>;
        if (typeof meta.seedKey === 'string') {
          existingSeedKeys.add(meta.seedKey);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Filter out items that have already been seeded
    const itemsToSeed = SEED_DATA.filter(
      (item) => !existingSeedKeys.has(item.seedKey)
    );

    if (itemsToSeed.length === 0) {
      // All items already exist — return counts
      const typeCounts = await getTypeCounts();
      return NextResponse.json({
        message: '个人画像数据已存在，无需重复初始化',
        seeded: 0,
        total: SEED_DATA.length,
        typeCounts,
      });
    }

    // Create new memories
    const created = await Promise.all(
      itemsToSeed.map((item) =>
        db.memoryItem.create({
          data: {
            memoryType: item.memoryType,
            content: item.content,
            importance: item.importance,
            confidence: item.confidence,
            sourceType: item.sourceType,
            scope: item.scope,
            status: 'active',
            metadata: JSON.stringify({
              ...item.metadata,
              seedKey: item.seedKey,
            }),
            versions: {
              create: {
                versionNo: 1,
                content: item.content,
                metadata: JSON.stringify({
                  ...item.metadata,
                  seedKey: item.seedKey,
                }),
                changeReason: '个人画像初始化',
              },
            },
          },
        })
      )
    );

    const typeCounts = await getTypeCounts();

    return NextResponse.json(
      {
        message: `成功初始化 ${created.length} 条个人画像记忆`,
        seeded: created.length,
        total: SEED_DATA.length,
        typeCounts,
        items: created.map((m) => ({
          id: m.id,
          memoryType: m.memoryType,
          content: m.content.substring(0, 50) + '...',
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Seed memories error:', error);
    return NextResponse.json(
      { error: 'Failed to seed memories' },
      { status: 500 }
    );
  }
}

// GET /api/memory/seed - Get seed status and type counts
export async function GET() {
  try {
    const typeCounts = await getTypeCounts();

    // Check which seed keys exist
    const existingMemories = await db.memoryItem.findMany({
      where: {
        sourceType: 'file',
        memoryType: { in: ['fact', 'skill', 'preference', 'rule', 'context'] },
      },
      select: { metadata: true },
    });

    const existingSeedKeys = new Set<string>();
    for (const mem of existingMemories) {
      try {
        const meta = JSON.parse(mem.metadata) as Record<string, unknown>;
        if (typeof meta.seedKey === 'string') {
          existingSeedKeys.add(meta.seedKey);
        }
      } catch {
        // Ignore
      }
    }

    const seededCount = SEED_DATA.filter((item) =>
      existingSeedKeys.has(item.seedKey)
    ).length;

    return NextResponse.json({
      isSeeded: seededCount === SEED_DATA.length,
      seededCount,
      totalSeedItems: SEED_DATA.length,
      typeCounts,
    });
  } catch (error) {
    console.error('Get seed status error:', error);
    return NextResponse.json(
      { error: 'Failed to get seed status' },
      { status: 500 }
    );
  }
}

// Helper: count memories by type
async function getTypeCounts(): Promise<Record<string, number>> {
  const types = ['fact', 'skill', 'preference', 'rule', 'context', 'event'];
  const counts: Record<string, number> = {};

  const results = await Promise.all(
    types.map((type) =>
      db.memoryItem.count({
        where: { memoryType: type, status: 'active' },
      })
    )
  );

  types.forEach((type, i) => {
    counts[type] = results[i];
  });

  return counts;
}
