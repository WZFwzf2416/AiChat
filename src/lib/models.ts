import {
  allowDemoProvider,
  appEnv,
  hasCompatibleApiKey,
  hasOpenAIKey,
  hasQwenKey,
  preferredCompatibleBackend,
} from "@/lib/env";
import type { AppModelProvider, ModelConfig } from "@/types/chat";

export const DEFAULT_SYSTEM_PROMPT = [
  "你是一名帮助前端开发者学习并搭建 AI 产品的工程搭档。",
  "回答时要兼顾工程可落地性、清晰解释和下一步建议。",
  "当需要使用工具时，先说明你的计划，再基于工具结果继续回答。",
].join(" ");

function buildQwenModelConfigs(): ModelConfig[] {
  const isPreferred =
    preferredCompatibleBackend === "qwen" || !preferredCompatibleBackend;

  return [
    {
      id: "qwen-plus",
      provider: "OPENAI",
      name: "通义千问 Qwen-Plus",
      modelId: appEnv.DEFAULT_QWEN_MODEL,
      isDefault: isPreferred,
      temperature: appEnv.DEFAULT_TEMPERATURE,
      maxOutputTokens: appEnv.DEFAULT_MAX_OUTPUT_TOKENS,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
    {
      id: "qwen-turbo",
      provider: "OPENAI",
      name: "通义千问 Qwen-Turbo",
      modelId: "qwen-turbo",
      isDefault: false,
      temperature: 0.7,
      maxOutputTokens: 1200,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
    {
      id: "qwen-max",
      provider: "OPENAI",
      name: "通义千问 Qwen-Max",
      modelId: "qwen-max",
      isDefault: false,
      temperature: 0.7,
      maxOutputTokens: 1200,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
  ];
}

function buildOpenAIModelConfigs(): ModelConfig[] {
  const isPreferred = preferredCompatibleBackend === "openai";

  return [
    {
      id: "openai-gpt-4.1-mini",
      provider: "OPENAI",
      name: "OpenAI GPT-4.1 Mini",
      modelId: appEnv.DEFAULT_OPENAI_MODEL,
      isDefault: isPreferred,
      temperature: appEnv.DEFAULT_TEMPERATURE,
      maxOutputTokens: appEnv.DEFAULT_MAX_OUTPUT_TOKENS,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
    {
      id: "openai-gpt-4o-mini",
      provider: "OPENAI",
      name: "OpenAI GPT-4o Mini",
      modelId: "gpt-4o-mini",
      isDefault: false,
      temperature: 0.7,
      maxOutputTokens: 1200,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
  ];
}

function shouldIncludeDemoProvider() {
  return !hasCompatibleApiKey || allowDemoProvider;
}

export function getAvailableModelConfigs(): ModelConfig[] {
  const modelConfigs: ModelConfig[] = [];

  if (hasQwenKey || !hasOpenAIKey) {
    modelConfigs.push(...buildQwenModelConfigs());
  }

  if (hasOpenAIKey) {
    modelConfigs.push(...buildOpenAIModelConfigs());
  }

  if (shouldIncludeDemoProvider()) {
    modelConfigs.push({
      id: "mock-learning-lab",
      provider: "MOCK",
      name: "学习实验室模拟器",
      modelId: "mock-learning-lab",
      isDefault: !hasCompatibleApiKey,
      temperature: 0.6,
      maxOutputTokens: 900,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
  }

  if (!modelConfigs.some((config) => config.isDefault)) {
    const firstLiveModel = modelConfigs.find(
      (config) => config.provider === "OPENAI",
    );
    if (firstLiveModel) {
      firstLiveModel.isDefault = true;
    }
  }

  return modelConfigs;
}

export const DEFAULT_MODEL_CONFIGS: ModelConfig[] = getAvailableModelConfigs();

export function getDefaultModelConfig(provider?: AppModelProvider) {
  const modelConfigs = getAvailableModelConfigs();

  if (provider) {
    const providerDefault = modelConfigs.find(
      (config) => config.provider === provider && config.isDefault,
    );

    if (providerDefault) {
      return providerDefault;
    }
  }

  return modelConfigs.find((config) => config.isDefault) ?? modelConfigs[0];
}

export function getSuggestedSessionProvider(
  hasLiveModelAccess: boolean,
): AppModelProvider {
  return hasLiveModelAccess ? "OPENAI" : "MOCK";
}
