import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// Seed data definitions for user profile (personal clone assistant)
// ============================================================

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
  // ── Facts ───────────────────────────────────────────────
  {
    memoryType: 'fact',
    content: '姓名：张三，职业定位：15年以上全栈架构师，专注于大型互联网系统的设计与落地',
    importance: 0.95,
    confidence: 0.99,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'identity', label: '姓名与职业' },
    seedKey: 'profile-name-role',
  },
  {
    memoryType: 'fact',
    content: '核心能力：系统架构设计、技术团队管理、全栈开发，具备从0到1构建复杂系统的能力',
    importance: 0.92,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'identity', label: '核心能力' },
    seedKey: 'profile-core-ability',
  },

  // ── Skills ──────────────────────────────────────────────
  {
    memoryType: 'skill',
    content: '前端技术栈：精通 React/Next.js/Vue/Angular，TypeScript 严格模式开发，Tailwind CSS / CSS-in-JS 样式方案，组件库设计与前端工程化',
    importance: 0.9,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '前端技术栈' },
    seedKey: 'skill-frontend',
  },
  {
    memoryType: 'skill',
    content: '后端技术栈：精通 Node.js/Python/Go，微服务架构设计，RESTful/GraphQL API 设计与实现，消息队列与异步处理',
    importance: 0.92,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '后端技术栈' },
    seedKey: 'skill-backend',
  },
  {
    memoryType: 'skill',
    content: '数据库：精通 PostgreSQL/MySQL/Redis/MongoDB，数据建模与查询优化，分库分表方案，缓存策略设计',
    importance: 0.9,
    confidence: 0.93,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: '数据库' },
    seedKey: 'skill-database',
  },
  {
    memoryType: 'skill',
    content: 'DevOps：Docker/Kubernetes 容器化部署，CI/CD 流水线搭建，云服务部署(AWS/阿里云)，基础设施即代码',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: 'DevOps' },
    seedKey: 'skill-devops',
  },
  {
    memoryType: 'skill',
    content: 'AI/ML：大模型应用开发，RAG 系统架构，LangChain/LlamaIndex 框架，Prompt Engineering，向量数据库与 Embedding 方案',
    importance: 0.91,
    confidence: 0.9,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tech', label: 'AI/ML' },
    seedKey: 'skill-ai-ml',
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
    content: '项目管理：敏捷开发实践(Scrum/Kanban)，技术方案评审与架构决策，跨团队协作与沟通，技术人才培养',
    importance: 0.85,
    confidence: 0.9,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'management', label: '项目管理' },
    seedKey: 'skill-project-mgmt',
  },

  // ── Preferences ─────────────────────────────────────────
  {
    memoryType: 'preference',
    content: '代码风格：TypeScript 严格模式，完善的类型定义，ESLint + Prettier 统一规范，代码评审优先',
    importance: 0.8,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'code', label: '代码风格' },
    seedKey: 'pref-code-style',
  },
  {
    memoryType: 'preference',
    content: '架构偏好：清洁架构(Clean Architecture)，领域驱动设计(DDD)，关注点分离，可测试性优先',
    importance: 0.82,
    confidence: 0.9,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'architecture', label: '架构偏好' },
    seedKey: 'pref-architecture',
  },
  {
    memoryType: 'preference',
    content: '工具偏好：VS Code + Vim 键位，Git 工作流(GitFlow/Trunk-based)，Docker 本地开发环境，终端优先的效率工具',
    importance: 0.75,
    confidence: 0.9,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'tools', label: '工具偏好' },
    seedKey: 'pref-tools',
  },
  {
    memoryType: 'preference',
    content: '沟通偏好：简洁直接的沟通风格，数据驱动决策，重视文档沉淀，异步优先减少会议',
    importance: 0.78,
    confidence: 0.88,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'communication', label: '沟通偏好' },
    seedKey: 'pref-communication',
  },

  // ── Rules ───────────────────────────────────────────────
  {
    memoryType: 'rule',
    content: '代码质量：零错误标准，完善的错误处理与异常恢复，单元测试覆盖率>80%，代码评审通过方可合并',
    importance: 0.9,
    confidence: 0.95,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'quality', label: '代码质量' },
    seedKey: 'rule-code-quality',
  },
  {
    memoryType: 'rule',
    content: '安全性：数据脱敏处理，API 鉴权与权限控制，敏感信息不进代码仓库，定期安全审计',
    importance: 0.92,
    confidence: 0.98,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'security', label: '安全性' },
    seedKey: 'rule-security',
  },
  {
    memoryType: 'rule',
    content: '性能标准：首屏加载<2秒，API 响应<200ms(P99)，核心接口可用性>99.9%，性能回归自动检测',
    importance: 0.88,
    confidence: 0.92,
    sourceType: 'file',
    scope: 'private',
    metadata: { category: 'performance', label: '性能标准' },
    seedKey: 'rule-performance',
  },
];

// POST /api/memory/seed - Seed user profile memories (idempotent)
export async function POST() {
  try {
    // Check for already-seeded items by looking for the seedKey in metadata
    const existingMemories = await db.memoryItem.findMany({
      where: {
        sourceType: 'file',
        memoryType: { in: ['fact', 'skill', 'preference', 'rule'] },
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
        memoryType: { in: ['fact', 'skill', 'preference', 'rule'] },
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
