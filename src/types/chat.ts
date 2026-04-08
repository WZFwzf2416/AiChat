export type ChatRole = "system" | "user" | "assistant" | "tool";
export type AppModelProvider = "OPENAI" | "MOCK";
export type AgentStepStatus = "pending" | "running" | "completed" | "failed";
export type RuntimeExperienceMode = "real" | "demo";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultRecord {
  toolCallId: string;
  toolName: string;
  result: string;
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
  metadata?: Record<string, unknown> | null;
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
}

export interface SessionSettingsPatch {
  modelConfigId?: string;
  modelProvider?: AppModelProvider;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
}
