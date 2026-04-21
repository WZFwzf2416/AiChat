export type ChatRole = "system" | "user" | "assistant" | "tool";
export type AppModelProvider = "OPENAI" | "MOCK";
export type AgentStepStatus = "pending" | "running" | "completed" | "failed";
export type RuntimeExperienceMode = "real" | "demo";
export type ChatMessageVisibility = "visible" | "debug" | "internal";
export type ChatTurnStatus = "streaming" | "completed" | "failed";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolSourceRecord {
  id?: string;
  title: string;
  sourceType?: "web" | "knowledge" | "api" | "system" | "tool";
  href?: string | null;
  snippet?: string | null;
  tags?: string[];
  confidence?: number | null;
  updatedAt?: string | null;
  citationLabel?: string | null;
  originTool?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ToolDisplayMetric {
  label: string;
  value: string;
}

export interface ToolDisplayData {
  kind: "time" | "weather" | "knowledge" | "generic";
  layout?: "status" | "metrics" | "list" | "table" | "timeline";
  title?: string;
  body?: string | null;
  items?: string[];
  metrics?: ToolDisplayMetric[];
  rows?: Array<Record<string, string>>;
  tone?: "info" | "success" | "warning" | "danger";
}

export interface ToolResultRecord {
  toolCallId: string;
  toolName: string;
  result: string;
  summary?: string | null;
  raw?: Record<string, unknown> | null;
  display?: ToolDisplayData | null;
  sources?: ToolSourceRecord[] | null;
}

export interface ChatMessageMetadata extends Record<string, unknown> {
  visibility?: ChatMessageVisibility;
  hidden?: boolean;
  streaming?: boolean;
  error?: boolean;
  turnId?: string;
  traceId?: string;
  citationLabels?: string[];
  citedSources?: ToolSourceRecord[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  toolCallId?: string | null;
  toolName?: string | null;
  toolCalls?: ToolCallRecord[] | null;
  toolResults?: ToolResultRecord[] | null;
  metadata?: ChatMessageMetadata | null;
}

export interface ModelConfig {
  id: string;
  provider: AppModelProvider;
  name: string;
  modelId: string;
  isDefault: boolean;
  temperature: number;
  maxOutputTokens: number;
  systemPrompt: string;
}

export interface AgentStep {
  id: string;
  status: AgentStepStatus;
  kind: string;
  label: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatTurnSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ChatTurnStatus;
  userMessageId: string | null;
  userContentPreview: string;
  visibleMessageCount: number;
  debugMessageCount: number;
  toolCount: number;
  stepCount: number;
  toolNames: string[];
  errorMessage: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  modelProvider: AppModelProvider;
  modelId: string;
  temperature: number;
  maxOutputTokens: number;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  agentSteps: AgentStep[];
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type SearchableKnowledgeEntry = Omit<
  KnowledgeEntry,
  "createdAt" | "updatedAt"
> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

export interface KnowledgeEntryInput {
  title: string;
  content: string;
  tags: string[];
}

export interface RuntimeStatus {
  storageMode: "prisma" | "memory";
  compatibleApiConfigured: boolean;
  preferredBackend: "openai" | "qwen" | null;
  experienceMode: RuntimeExperienceMode;
  demoModeReason?: string | null;
}

export interface ChatBootstrapPayload {
  sessions: ChatSession[];
  modelConfigs: ModelConfig[];
  runtime: RuntimeStatus;
  knowledgeEntries: KnowledgeEntry[];
}

export interface SessionSettingsPatch {
  modelConfigId?: string;
  modelProvider?: AppModelProvider;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
}
