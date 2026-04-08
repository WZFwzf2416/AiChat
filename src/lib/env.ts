import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  QWEN_BASE_URL: z
    .string()
    .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
  DEFAULT_OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  DEFAULT_QWEN_MODEL: z.string().default("qwen-plus"),
  DEFAULT_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  DEFAULT_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(4096).default(1200),
  ALLOW_DEMO_PROVIDER: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
});

export const appEnv = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  QWEN_API_KEY: process.env.QWEN_API_KEY,
  QWEN_BASE_URL: process.env.QWEN_BASE_URL,
  DEFAULT_OPENAI_MODEL: process.env.DEFAULT_OPENAI_MODEL,
  DEFAULT_QWEN_MODEL: process.env.DEFAULT_QWEN_MODEL,
  DEFAULT_TEMPERATURE: process.env.DEFAULT_TEMPERATURE,
  DEFAULT_MAX_OUTPUT_TOKENS: process.env.DEFAULT_MAX_OUTPUT_TOKENS,
  ALLOW_DEMO_PROVIDER: process.env.ALLOW_DEMO_PROVIDER,
});

export const hasOpenAIKey = Boolean(appEnv.OPENAI_API_KEY);
export const hasQwenKey = Boolean(appEnv.QWEN_API_KEY);
export const hasCompatibleApiKey = hasOpenAIKey || hasQwenKey;
export const allowDemoProvider = appEnv.ALLOW_DEMO_PROVIDER;
export const preferredCompatibleBackend: "qwen" | "openai" | null = hasQwenKey
  ? "qwen"
  : hasOpenAIKey
    ? "openai"
    : null;
