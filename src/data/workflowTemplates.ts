/**
 * ワークフローテンプレート集
 * 実用的なワークフローの雛形を提供
 */

import { Workflow, WorkflowNode, Connection } from '../types/workflow';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
    nodes: WorkflowNode[];
    connections: Connection[];
    instructions: string;
    useCases: string[];
}

// ユーティリティ関数：ノード作成
const createNode = (
    id: string,
    type: WorkflowNode['type'],
    x: number,
    y: number,
    config: WorkflowNode['config']
): WorkflowNode => ({
    id,
    type,
    position: { x, y },
    config,
    inputs: [],
    outputs: []
});

// ユーティリティ関数：接続作成
const createConnection = (
    sourceNodeId: string,
    targetNodeId: string,
    sourcePort: string = 'output',
    targetPort: string = 'input'
): Connection => ({
    sourceNodeId,
    targetNodeId,
    sourcePort,
    targetPort
});

export const workflowTemplates: WorkflowTemplate[] = [
    // 1. 基本的なコンテンツ作成ワークフロー
    {
        id: 'content-creation-basic',
        name: '基本コンテンツ作成',
        description: 'トピックから記事を作成する基本的なワークフロー',
        category: 'コンテンツ作成',
        difficulty: 'beginner',
        tags: ['記事作成', '基本', 'ブログ'],
        instructions: `
1. トピック入力ノードでテーマを設定
2. リサーチエージェントが情報収集
3. ライターエージェントが記事作成
4. 最終的な記事を出力

使用方法：
- トピック入力に「AI技術の最新動向」などのテーマを入力
- 各エージェントの設定を確認
- ワークフローを実行
        `,
        useCases: [
            'ブログ記事の作成',
            'ニュース記事の執筆',
            'レポートの下書き作成',
            'SNS投稿の作成'
        ],
        nodes: [
            createNode('input-topic', 'input', 100, 200, {
                prompt: 'トピックを入力してください（例：AI技術の最新動向）'
            }),
            createNode('research-agent', 'process', 350, 150, {
                prompt: 'あなたは専門リサーチャーです。与えられたトピックについて、最新の情報を調査し、重要なポイントを整理してください。信頼できる情報源を重視し、事実に基づいた内容をまとめてください。',
                agentRole: 'リサーチャー'
            }),
            createNode('writer-agent', 'process', 350, 250, {
                prompt: 'あなたは経験豊富なライターです。リサーチ結果を基に、読みやすく魅力的な記事を作成してください。構成は導入・本文・結論の形式で、読者にとって価値のある内容にしてください。',
                agentRole: 'ライター'
            }),
            createNode('output-article', 'output', 600, 200, {
                prompt: '完成した記事を出力します'
            })
        ],
        connections: [
            createConnection('input-topic', 'research-agent'),
            createConnection('research-agent', 'writer-agent'),
            createConnection('writer-agent', 'output-article')
        ]
    },

    // 2. 高度なコンテンツ作成ワークフロー（校正・SEO付き）
    {
        id: 'content-creation-advanced',
        name: '高度コンテンツ作成（校正・SEO付き）',
        description: 'リサーチ、執筆、校正、SEO最適化を含む包括的なコンテンツ作成',
        category: 'コンテンツ作成',
        difficulty: 'advanced',
        tags: ['記事作成', 'SEO', '校正', '高品質'],
        instructions: `
高品質なコンテンツを作成するための包括的ワークフロー：

1. トピック入力とキーワード設定
2. 競合分析エージェントが市場調査
3. リサーチエージェントが詳細調査
4. アウトラインエージェントが構成作成
5. ライターエージェントが執筆
6. 校正エージェントが文章チェック
7. SEOエージェントが最適化
8. 品質チェックで最終確認
9. 完成記事を出力

このワークフローは商用レベルのコンテンツ作成に適しています。
        `,
        useCases: [
            '企業ブログの記事作成',
            'マーケティングコンテンツ',
            'SEO記事の作成',
            'プレスリリース',
            '技術文書の作成'
        ],
        nodes: [
            createNode('input-topic', 'input', 50, 200, {
                prompt: 'メイントピックとターゲットキーワードを入力してください'
            }),
            createNode('competitor-analysis', 'process', 200, 100, {
                prompt: 'あなたは市場分析の専門家です。与えられたトピックについて競合他社の記事を分析し、差別化ポイントと改善点を特定してください。',
                agentRole: '競合分析専門家'
            }),
            createNode('research-agent', 'process', 200, 200, {
                prompt: 'あなたは専門リサーチャーです。トピックについて徹底的に調査し、最新データ、統計、専門家の意見を収集してください。',
                agentRole: 'リサーチャー'
            }),
            createNode('outline-agent', 'process', 350, 150, {
                prompt: 'あなたは構成の専門家です。リサーチ結果と競合分析を基に、論理的で読みやすい記事構成を作成してください。',
                agentRole: '構成専門家'
            }),
            createNode('writer-agent', 'process', 500, 200, {
                prompt: 'あなたは経験豊富なライターです。アウトラインに従って、魅力的で読みやすい記事を執筆してください。',
                agentRole: 'ライター'
            }),
            createNode('editor-agent', 'process', 650, 150, {
                prompt: 'あなたは校正の専門家です。文章の誤字脱字、文法、論理構成をチェックし、改善提案を行ってください。',
                agentRole: '校正者'
            }),
            createNode('seo-agent', 'process', 650, 250, {
                prompt: 'あなたはSEOの専門家です。記事をSEO最適化し、キーワード配置、メタ情報、構造化データを提案してください。',
                agentRole: 'SEO専門家'
            }),
            createNode('quality-check', 'condition', 800, 200, {
                condition: '記事の品質が基準を満たしているか？（文字数、キーワード密度、読みやすさ）'
            }),
            createNode('output-article', 'output', 950, 200, {
                prompt: '最終的な高品質記事を出力します'
            }),
            createNode('revision-needed', 'output', 800, 300, {
                prompt: '修正が必要な箇所をフィードバックとして出力します'
            })
        ],
        connections: [
            createConnection('input-topic', 'competitor-analysis'),
            createConnection('input-topic', 'research-agent'),
            createConnection('competitor-analysis', 'outline-agent'),
            createConnection('research-agent', 'outline-agent'),
            createConnection('outline-agent', 'writer-agent'),
            createConnection('writer-agent', 'editor-agent'),
            createConnection('writer-agent', 'seo-agent'),
            createConnection('editor-agent', 'quality-check'),
            createConnection('seo-agent', 'quality-check'),
            createConnection('quality-check', 'output-article'),
            createConnection('quality-check', 'revision-needed')
        ]
    },

    // 3. カスタマーサポート自動化
    {
        id: 'customer-support-automation',
        name: 'カスタマーサポート自動化',
        description: '顧客の問い合わせを分析し、適切な回答を生成する自動化システム',
        category: 'カスタマーサポート',
        difficulty: 'intermediate',
        tags: ['サポート', '自動化', '顧客対応'],
        instructions: `
顧客サポートを自動化するワークフロー：

1. 顧客の問い合わせを入力
2. 問い合わせ分類エージェントがカテゴリ分析
3. 緊急度判定で優先度を決定
4. 技術的問題か一般的問題かで分岐
5. 各専門エージェントが回答作成
6. 品質チェックで回答を検証
7. 最終回答を出力

24時間対応可能な自動サポートシステムです。
        `,
        useCases: [
            'ECサイトの問い合わせ対応',
            'SaaSプロダクトのサポート',
            'FAQ自動生成',
            'チケット分類システム'
        ],
        nodes: [
            createNode('input-inquiry', 'input', 50, 250, {
                prompt: '顧客からの問い合わせ内容を入力してください'
            }),
            createNode('classify-inquiry', 'process', 200, 250, {
                prompt: 'あなたは顧客サポートの専門家です。問い合わせ内容を分析し、カテゴリ（技術的問題、請求問題、使用方法、苦情など）と緊急度を判定してください。',
                agentRole: '問い合わせ分類専門家'
            }),
            createNode('urgency-check', 'condition', 350, 250, {
                condition: '緊急度は高いか？（システム障害、セキュリティ問題、請求エラーなど）'
            }),
            createNode('technical-check', 'condition', 500, 200, {
                condition: '技術的な問題か？'
            }),
            createNode('technical-agent', 'process', 650, 150, {
                prompt: 'あなたは技術サポートの専門家です。技術的な問題について、分かりやすく段階的な解決方法を提供してください。',
                agentRole: '技術サポート専門家'
            }),
            createNode('general-agent', 'process', 650, 250, {
                prompt: 'あなたは一般サポートの専門家です。使用方法、請求、ポリシーなどについて親切で分かりやすい回答を提供してください。',
                agentRole: '一般サポート専門家'
            }),
            createNode('urgent-escalation', 'output', 500, 350, {
                prompt: '緊急案件として人間のサポート担当者にエスカレーションします'
            }),
            createNode('quality-check', 'condition', 800, 200, {
                condition: '回答は適切で完全か？'
            }),
            createNode('output-response', 'output', 950, 200, {
                prompt: '顧客への最終回答を出力します'
            }),
            createNode('needs-review', 'output', 800, 300, {
                prompt: '人間による確認が必要な回答として出力します'
            })
        ],
        connections: [
            createConnection('input-inquiry', 'classify-inquiry'),
            createConnection('classify-inquiry', 'urgency-check'),
            createConnection('urgency-check', 'urgent-escalation'),
            createConnection('urgency-check', 'technical-check'),
            createConnection('technical-check', 'technical-agent'),
            createConnection('technical-check', 'general-agent'),
            createConnection('technical-agent', 'quality-check'),
            createConnection('general-agent', 'quality-check'),
            createConnection('quality-check', 'output-response'),
            createConnection('quality-check', 'needs-review')
        ]
    },

    // 4. データ分析レポート生成
    {
        id: 'data-analysis-report',
        name: 'データ分析レポート自動生成',
        description: 'データを分析し、洞察とレコメンデーションを含むレポートを自動生成',
        category: 'データ分析',
        difficulty: 'advanced',
        tags: ['データ分析', 'レポート', 'BI', '可視化'],
        instructions: `
データ分析からレポート生成までの自動化ワークフロー：

1. データソースと分析目的を入力
2. データ検証エージェントが品質チェック
3. 統計分析エージェントが基本統計を算出
4. トレンド分析エージェントが傾向を分析
5. 異常検知エージェントが異常値を特定
6. 洞察抽出エージェントがビジネス洞察を生成
7. 可視化エージェントがグラフ・チャートを提案
8. レポート作成エージェントが総合レポートを作成
9. 最終レポートを出力

ビジネスインテリジェンスに活用できる包括的な分析システムです。
        `,
        useCases: [
            '売上分析レポート',
            'マーケティング効果測定',
            'ユーザー行動分析',
            '財務分析レポート',
            'KPI監視レポート'
        ],
        nodes: [
            createNode('input-data', 'input', 50, 300, {
                prompt: 'データソース（CSV、API、データベース）と分析目的を入力してください'
            }),
            createNode('data-validation', 'process', 200, 200, {
                prompt: 'あなたはデータ品質の専門家です。データの完整性、一貫性、異常値をチェックし、データクリーニングの提案を行ってください。',
                agentRole: 'データ品質専門家'
            }),
            createNode('statistical-analysis', 'process', 200, 300, {
                prompt: 'あなたは統計分析の専門家です。基本統計量（平均、中央値、標準偏差など）を算出し、データの分布を分析してください。',
                agentRole: '統計分析専門家'
            }),
            createNode('trend-analysis', 'process', 200, 400, {
                prompt: 'あなたはトレンド分析の専門家です。時系列データから傾向、季節性、周期性を特定し、将来予測を行ってください。',
                agentRole: 'トレンド分析専門家'
            }),
            createNode('anomaly-detection', 'process', 400, 200, {
                prompt: 'あなたは異常検知の専門家です。データから異常値やパターンの変化を特定し、その原因と影響を分析してください。',
                agentRole: '異常検知専門家'
            }),
            createNode('insight-extraction', 'process', 400, 350, {
                prompt: 'あなたはビジネスアナリストです。分析結果からビジネスに役立つ洞察を抽出し、アクションプランを提案してください。',
                agentRole: 'ビジネスアナリスト'
            }),
            createNode('visualization-agent', 'process', 600, 250, {
                prompt: 'あなたはデータ可視化の専門家です。分析結果を効果的に伝えるグラフ、チャート、ダッシュボードの設計を提案してください。',
                agentRole: 'データ可視化専門家'
            }),
            createNode('report-generator', 'process', 600, 400, {
                prompt: 'あなたはレポート作成の専門家です。全ての分析結果を統合し、エグゼクティブサマリー、詳細分析、推奨事項を含む包括的なレポートを作成してください。',
                agentRole: 'レポート作成専門家'
            }),
            createNode('output-report', 'output', 800, 325, {
                prompt: '完成したデータ分析レポートを出力します'
            })
        ],
        connections: [
            createConnection('input-data', 'data-validation'),
            createConnection('input-data', 'statistical-analysis'),
            createConnection('input-data', 'trend-analysis'),
            createConnection('data-validation', 'anomaly-detection'),
            createConnection('statistical-analysis', 'insight-extraction'),
            createConnection('trend-analysis', 'insight-extraction'),
            createConnection('anomaly-detection', 'insight-extraction'),
            createConnection('insight-extraction', 'visualization-agent'),
            createConnection('insight-extraction', 'report-generator'),
            createConnection('visualization-agent', 'report-generator'),
            createConnection('report-generator', 'output-report')
        ]
    },

    // 5. ソーシャルメディア管理
    {
        id: 'social-media-management',
        name: 'ソーシャルメディア管理',
        description: '複数のSNSプラットフォーム向けコンテンツを一括作成・最適化',
        category: 'マーケティング',
        difficulty: 'intermediate',
        tags: ['SNS', 'マーケティング', 'コンテンツ', '自動化'],
        instructions: `
ソーシャルメディア投稿を効率化するワークフロー：

1. 基本コンテンツとターゲット情報を入力
2. トレンド分析エージェントが最新トレンドを調査
3. プラットフォーム別に最適化
   - Twitter: 短文・ハッシュタグ最適化
   - Instagram: ビジュアル重視・ストーリー対応
   - LinkedIn: プロフェッショナル向け
   - Facebook: エンゲージメント重視
4. 投稿スケジュール最適化
5. 各プラットフォーム向けコンテンツを出力

一つのコンテンツから複数のSNS投稿を効率的に作成できます。
        `,
        useCases: [
            'ブランドのSNS運用',
            'イベント告知の拡散',
            '商品プロモーション',
            '企業の情報発信',
            'インフルエンサーマーケティング'
        ],
        nodes: [
            createNode('input-content', 'input', 50, 300, {
                prompt: '基本コンテンツ、ターゲット層、投稿目的を入力してください'
            }),
            createNode('trend-analysis', 'process', 200, 200, {
                prompt: 'あなたはSNSトレンドの専門家です。現在のトレンド、人気ハッシュタグ、最適な投稿時間を分析してください。',
                agentRole: 'SNSトレンド専門家'
            }),
            createNode('twitter-optimizer', 'process', 400, 150, {
                prompt: 'あなたはTwitterマーケティングの専門家です。280文字以内で魅力的なツイートを作成し、効果的なハッシュタグを提案してください。',
                agentRole: 'Twitter専門家'
            }),
            createNode('instagram-optimizer', 'process', 400, 250, {
                prompt: 'あなたはInstagramマーケティングの専門家です。ビジュアル重視のキャプション、ストーリー用テキスト、リール用コンテンツを作成してください。',
                agentRole: 'Instagram専門家'
            }),
            createNode('linkedin-optimizer', 'process', 400, 350, {
                prompt: 'あなたはLinkedInマーケティングの専門家です。プロフェッショナル向けの投稿内容を作成し、業界の専門性をアピールしてください。',
                agentRole: 'LinkedIn専門家'
            }),
            createNode('facebook-optimizer', 'process', 400, 450, {
                prompt: 'あなたはFacebookマーケティングの専門家です。エンゲージメントを高める投稿内容を作成し、コミュニティ形成を促進してください。',
                agentRole: 'Facebook専門家'
            }),
            createNode('schedule-optimizer', 'process', 600, 300, {
                prompt: 'あなたはSNS運用の専門家です。各プラットフォームの最適な投稿時間とスケジュールを提案してください。',
                agentRole: 'SNS運用専門家'
            }),
            createNode('output-twitter', 'output', 750, 150, {
                prompt: 'Twitter用の最適化されたコンテンツを出力します'
            }),
            createNode('output-instagram', 'output', 750, 250, {
                prompt: 'Instagram用の最適化されたコンテンツを出力します'
            }),
            createNode('output-linkedin', 'output', 750, 350, {
                prompt: 'LinkedIn用の最適化されたコンテンツを出力します'
            }),
            createNode('output-facebook', 'output', 750, 450, {
                prompt: 'Facebook用の最適化されたコンテンツを出力します'
            }),
            createNode('output-schedule', 'output', 750, 550, {
                prompt: '投稿スケジュールとタイミング提案を出力します'
            })
        ],
        connections: [
            createConnection('input-content', 'trend-analysis'),
            createConnection('trend-analysis', 'twitter-optimizer'),
            createConnection('trend-analysis', 'instagram-optimizer'),
            createConnection('trend-analysis', 'linkedin-optimizer'),
            createConnection('trend-analysis', 'facebook-optimizer'),
            createConnection('input-content', 'twitter-optimizer'),
            createConnection('input-content', 'instagram-optimizer'),
            createConnection('input-content', 'linkedin-optimizer'),
            createConnection('input-content', 'facebook-optimizer'),
            createConnection('twitter-optimizer', 'schedule-optimizer'),
            createConnection('instagram-optimizer', 'schedule-optimizer'),
            createConnection('linkedin-optimizer', 'schedule-optimizer'),
            createConnection('facebook-optimizer', 'schedule-optimizer'),
            createConnection('twitter-optimizer', 'output-twitter'),
            createConnection('instagram-optimizer', 'output-instagram'),
            createConnection('linkedin-optimizer', 'output-linkedin'),
            createConnection('facebook-optimizer', 'output-facebook'),
            createConnection('schedule-optimizer', 'output-schedule')
        ]
    },

    // 6. 教育コンテンツ作成
    {
        id: 'educational-content-creation',
        name: '教育コンテンツ作成システム',
        description: '学習目標に基づいて体系的な教育コンテンツを作成',
        category: '教育',
        difficulty: 'advanced',
        tags: ['教育', 'eラーニング', 'カリキュラム', '学習'],
        instructions: `
教育コンテンツを体系的に作成するワークフロー：

1. 学習目標とターゲット層を入力
2. カリキュラム設計エージェントが学習計画を作成
3. 難易度調整エージェントがレベル分けを実施
4. コンテンツ作成エージェントが各章を作成
5. 演習問題作成エージェントが練習問題を生成
6. 評価基準エージェントがテスト問題を作成
7. 学習効果測定の仕組みを設計
8. 完全な教育パッケージを出力

企業研修、オンライン講座、学校教育に活用できます。
        `,
        useCases: [
            '企業の新人研修プログラム',
            'オンライン講座の作成',
            '技術研修コンテンツ',
            '資格試験対策講座',
            '学校の授業教材'
        ],
        nodes: [
            createNode('input-objectives', 'input', 50, 300, {
                prompt: '学習目標、対象者のレベル、学習期間、重要なトピックを入力してください'
            }),
            createNode('curriculum-designer', 'process', 200, 200, {
                prompt: 'あなたは教育カリキュラムの専門家です。学習目標を達成するための体系的な学習計画を作成し、各章の学習順序と時間配分を設計してください。',
                agentRole: 'カリキュラム設計専門家'
            }),
            createNode('difficulty-adjuster', 'process', 200, 400, {
                prompt: 'あなたは教育心理学の専門家です。対象者のレベルに応じて内容の難易度を調整し、段階的な学習進行を設計してください。',
                agentRole: '教育心理学専門家'
            }),
            createNode('content-creator', 'process', 400, 250, {
                prompt: 'あなたは教育コンテンツ作成の専門家です。各章の詳細な学習内容を作成し、理解しやすい説明と具体例を含めてください。',
                agentRole: '教育コンテンツ専門家'
            }),
            createNode('exercise-generator', 'process', 400, 350, {
                prompt: 'あなたは教育評価の専門家です。各章に対応する練習問題、演習、実践課題を作成し、学習者の理解度を確認できるようにしてください。',
                agentRole: '教育評価専門家'
            }),
            createNode('assessment-designer', 'process', 600, 200, {
                prompt: 'あなたはテスト設計の専門家です。学習目標の達成度を測定する包括的な評価テストを作成してください。',
                agentRole: 'テスト設計専門家'
            }),
            createNode('learning-analytics', 'process', 600, 400, {
                prompt: 'あなたは学習分析の専門家です。学習効果を測定し、改善点を特定するための分析手法を設計してください。',
                agentRole: '学習分析専門家'
            }),
            createNode('output-curriculum', 'output', 800, 200, {
                prompt: '完全な教育カリキュラムパッケージを出力します'
            }),
            createNode('output-materials', 'output', 800, 300, {
                prompt: '学習教材と演習問題を出力します'
            }),
            createNode('output-assessment', 'output', 800, 400, {
                prompt: '評価テストと分析ツールを出力します'
            })
        ],
        connections: [
            createConnection('input-objectives', 'curriculum-designer'),
            createConnection('input-objectives', 'difficulty-adjuster'),
            createConnection('curriculum-designer', 'content-creator'),
            createConnection('difficulty-adjuster', 'content-creator'),
            createConnection('content-creator', 'exercise-generator'),
            createConnection('curriculum-designer', 'assessment-designer'),
            createConnection('exercise-generator', 'learning-analytics'),
            createConnection('curriculum-designer', 'output-curriculum'),
            createConnection('content-creator', 'output-materials'),
            createConnection('exercise-generator', 'output-materials'),
            createConnection('assessment-designer', 'output-assessment'),
            createConnection('learning-analytics', 'output-assessment')
        ]
    }
];

// テンプレートからワークフローを作成する関数
export const createWorkflowFromTemplate = (template: WorkflowTemplate): Workflow => {
    console.log('[createWorkflowFromTemplate] Starting creation from template:', template.name);

    try {
        // ユニークなIDを生成
        const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('[createWorkflowFromTemplate] Generated workflow ID:', workflowId);

        // ノードIDをユニークにする
        const nodeIdMap = new Map<string, string>();
        const updatedNodes = template.nodes.map(node => {
            const newNodeId = `${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            nodeIdMap.set(node.id, newNodeId);

            const updatedNode = {
                ...node,
                id: newNodeId
            };

            console.log('[createWorkflowFromTemplate] Created node:', updatedNode.id, 'type:', updatedNode.type);
            return updatedNode;
        });

        // 接続を更新（新しいノードIDを使用）
        const updatedConnections = template.connections.map(connection => {
            const updatedConnection = {
                ...connection,
                sourceNodeId: nodeIdMap.get(connection.sourceNodeId) || connection.sourceNodeId,
                targetNodeId: nodeIdMap.get(connection.targetNodeId) || connection.targetNodeId
            };

            console.log('[createWorkflowFromTemplate] Updated connection:',
                updatedConnection.sourceNodeId, '->', updatedConnection.targetNodeId);
            return updatedConnection;
        });

        const newWorkflow: Workflow = {
            id: workflowId,
            name: template.name,
            nodes: updatedNodes,
            connections: updatedConnections,
            status: 'draft'
        };

        console.log('[createWorkflowFromTemplate] Successfully created workflow:', newWorkflow);
        return newWorkflow;

    } catch (error) {
        console.error('[createWorkflowFromTemplate] Error creating workflow:', error);
        throw new Error(`テンプレートからワークフローを作成できませんでした: ${(error as Error).message}`);
    }
};

// カテゴリ別テンプレート取得
export const getTemplatesByCategory = (category: string): WorkflowTemplate[] => {
    return workflowTemplates.filter(template => template.category === category);
};

// 難易度別テンプレート取得
export const getTemplatesByDifficulty = (difficulty: WorkflowTemplate['difficulty']): WorkflowTemplate[] => {
    return workflowTemplates.filter(template => template.difficulty === difficulty);
};

// タグ検索
export const searchTemplatesByTag = (tag: string): WorkflowTemplate[] => {
    return workflowTemplates.filter(template =>
        template.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
    );
};

// 全カテゴリ取得
export const getAllCategories = (): string[] => {
    return [...new Set(workflowTemplates.map(template => template.category))];
};