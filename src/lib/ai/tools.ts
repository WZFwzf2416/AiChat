import { z } from "zod";

import type { ToolCategory, ToolRiskLevel } from "@/lib/ai/runtime/shared";
import { searchKnowledgeBase } from "@/lib/repositories/chat-repository";
import { createId } from "@/lib/utils";
import type {
  AgentStep,
  ChatMessageMetadata,
  ToolDisplayData,
  ToolResultRecord,
  ToolSourceRecord,
} from "@/types/chat";

type ToolExecution = {
  toolMessage: {
    role: "tool";
    content: string;
    toolCallId: string;
    toolName: string;
    toolResults: ToolResultRecord[];
    metadata: ChatMessageMetadata;
  };
  agentStep: AgentStep;
};

export type ToolDefinition = {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  source: string;
  timeoutMs?: number;
  retryable?: boolean;
  parameters: z.ZodType<Record<string, unknown>>;
  execute: (
    args: Record<string, unknown>,
    toolCallId: string,
  ) => Promise<ToolExecution>;
};

const currentTimeSchema = z.object({
  timezone: z.string().default("Asia/Shanghai"),
});

const weatherSchema = z.object({
  city: z.string().min(1),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

const knowledgeSchema = z.object({
  query: z.string().min(2),
});

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

type OpenMeteoLocation = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type OpenMeteoWeatherResponse = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  current_units?: Record<string, string>;
};

const weatherDescriptions: Record<number, string> = {
  0: "晴朗",
  1: "大部晴朗",
  2: "局部多云",
  3: "阴天",
  45: "有雾",
  48: "有雾并伴随霜冻",
  51: "小毛毛雨",
  53: "中等毛毛雨",
  55: "强毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "冰粒",
  80: "阵雨",
  81: "较强阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "雷暴伴冰雹",
  99: "强雷暴伴冰雹",
};

function formatLocationLabel(result: OpenMeteoLocation) {
  return [result.name, result.admin1, result.country].filter(Boolean).join(" / ");
}

function formatWeatherCode(code?: number) {
  if (typeof code !== "number") {
    return "天气状态未知";
  }

  return weatherDescriptions[code] ?? `天气代码 ${code}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`外部接口请求失败：${response.status}`);
  }

  return (await response.json()) as T;
}

async function getLiveWeather(city: string, unit: "celsius" | "fahrenheit") {
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.searchParams.set("name", city);
  geocodingUrl.searchParams.set("count", "1");
  geocodingUrl.searchParams.set("language", "zh");
  geocodingUrl.searchParams.set("format", "json");

  const geocoding = await fetchJson<OpenMeteoGeocodingResponse>(
    geocodingUrl.toString(),
  );
  const location = geocoding.results?.[0];

  if (!location) {
    throw new Error(`未找到城市：${city}`);
  }

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(location.latitude));
  weatherUrl.searchParams.set("longitude", String(location.longitude));
  weatherUrl.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
    ].join(","),
  );
  weatherUrl.searchParams.set("timezone", location.timezone || "auto");
  weatherUrl.searchParams.set(
    "temperature_unit",
    unit === "fahrenheit" ? "fahrenheit" : "celsius",
  );
  weatherUrl.searchParams.set(
    "wind_speed_unit",
    unit === "fahrenheit" ? "mph" : "kmh",
  );
  weatherUrl.searchParams.set("precipitation_unit", "mm");

  const weather = await fetchJson<OpenMeteoWeatherResponse>(weatherUrl.toString());
  const current = weather.current;

  if (!current) {
    throw new Error(`天气接口没有返回当前天气：${city}`);
  }

  return {
    locationLabel: formatLocationLabel(location),
    timezone: weather.timezone || location.timezone || "auto",
    observedAt: current.time ?? null,
    temperature: current.temperature_2m ?? null,
    apparentTemperature: current.apparent_temperature ?? null,
    humidity: current.relative_humidity_2m ?? null,
    precipitation: current.precipitation ?? null,
    windSpeed: current.wind_speed_10m ?? null,
    windDirection: current.wind_direction_10m ?? null,
    weatherCode: current.weather_code ?? null,
    weatherDescription: formatWeatherCode(current.weather_code),
    units: weather.current_units ?? {},
  };
}

function createToolResult(params: {
  toolCallId: string;
  toolName: string;
  result: string;
  summary?: string | null;
  raw?: Record<string, unknown> | null;
  display?: ToolDisplayData | null;
  sources?: ToolSourceRecord[] | null;
}): ToolResultRecord {
  return {
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    result: params.result,
    summary: params.summary ?? params.result,
    raw: params.raw ?? null,
    display: params.display ?? null,
    sources: params.sources ?? null,
  };
}

function createToolMessageMetadata(base: ChatMessageMetadata) {
  return {
    visibility: "visible" as const,
    liveData: true,
    ...base,
  };
}

const tools: ToolDefinition[] = [
  {
    name: "get_current_time",
    displayName: "当前时间",
    description: "获取指定 IANA 时区的当前时间。",
    category: "system",
    riskLevel: "low",
    source: "runtime-clock",
    timeoutMs: 2_000,
    retryable: false,
    parameters: currentTimeSchema,
    async execute(args, toolCallId) {
      const parsed = currentTimeSchema.parse(args);
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: parsed.timezone,
      }).format(now);
      const summary = `${parsed.timezone} 当前时间：${formatted}`;

      const toolResult = createToolResult({
        toolCallId,
        toolName: "get_current_time",
        result: summary,
        raw: {
          timezone: parsed.timezone,
          iso: now.toISOString(),
        },
        display: {
          kind: "time",
          layout: "status",
          title: "时间查询结果",
          body: formatted,
          items: [`时区：${parsed.timezone}`],
          tone: "info",
        },
        sources: [
          {
            title: "Runtime Clock",
            sourceType: "system",
            confidence: 1,
            citationLabel: "SYS-1",
            originTool: "get_current_time",
          },
        ],
      });

      return {
        toolMessage: {
          role: "tool",
          content: summary,
          toolCallId,
          toolName: "get_current_time",
          toolResults: [toolResult],
          metadata: createToolMessageMetadata({
            timezone: parsed.timezone,
            source: "runtime-clock",
          }),
        },
        agentStep: {
          id: createId("step"),
          status: "completed",
          kind: "tool",
          label: `查询时间：${parsed.timezone}`,
          payload: {
            toolName: "get_current_time",
            arguments: parsed,
            summary,
          },
          createdAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    name: "get_weather_snapshot",
    displayName: "实时天气",
    description: "获取指定城市的实时天气快照。",
    category: "live-data",
    riskLevel: "medium",
    source: "open-meteo",
    timeoutMs: 10_000,
    retryable: true,
    parameters: weatherSchema,
    async execute(args, toolCallId) {
      const parsed = weatherSchema.parse(args);
      const weather = await getLiveWeather(parsed.city, parsed.unit);
      const temperatureUnit =
        weather.units.temperature_2m ??
        (parsed.unit === "fahrenheit" ? "°F" : "°C");
      const humidityUnit = weather.units.relative_humidity_2m ?? "%";
      const precipitationUnit = weather.units.precipitation ?? "mm";
      const windUnit =
        weather.units.wind_speed_10m ??
        (parsed.unit === "fahrenheit" ? "mph" : "km/h");

      const summary = [
        `${weather.locationLabel} 当前天气：${weather.weatherDescription}`,
        weather.temperature !== null
          ? `气温 ${weather.temperature}${temperatureUnit}`
          : null,
        weather.apparentTemperature !== null
          ? `体感 ${weather.apparentTemperature}${temperatureUnit}`
          : null,
        weather.humidity !== null
          ? `湿度 ${weather.humidity}${humidityUnit}`
          : null,
        weather.precipitation !== null
          ? `降水 ${weather.precipitation}${precipitationUnit}`
          : null,
        weather.windSpeed !== null ? `风速 ${weather.windSpeed}${windUnit}` : null,
      ]
        .filter(Boolean)
        .join("，");

      const toolResult = createToolResult({
        toolCallId,
        toolName: "get_weather_snapshot",
        result: summary,
        raw: {
          requestedCity: parsed.city,
          unit: parsed.unit,
          ...weather,
        },
        display: {
          kind: "weather",
          layout: "metrics",
          title: weather.locationLabel,
          body: weather.weatherDescription,
          metrics: [
            weather.temperature !== null
              ? { label: "气温", value: `${weather.temperature}${temperatureUnit}` }
              : null,
            weather.apparentTemperature !== null
              ? {
                  label: "体感",
                  value: `${weather.apparentTemperature}${temperatureUnit}`,
                }
              : null,
            weather.humidity !== null
              ? { label: "湿度", value: `${weather.humidity}${humidityUnit}` }
              : null,
            weather.windSpeed !== null
              ? { label: "风速", value: `${weather.windSpeed}${windUnit}` }
              : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>,
          items: [
            weather.precipitation !== null
              ? `降水：${weather.precipitation}${precipitationUnit}`
              : null,
            weather.windDirection !== null
              ? `风向：${weather.windDirection}°`
              : null,
            weather.observedAt ? `观测时间：${weather.observedAt}` : null,
            weather.timezone ? `时区：${weather.timezone}` : null,
          ].filter(Boolean) as string[],
          tone: "success",
        },
        sources: [
          {
            title: "Open-Meteo",
            sourceType: "api",
            href: "https://open-meteo.com/",
            confidence: 0.98,
            citationLabel: "WX-1",
            originTool: "get_weather_snapshot",
            meta: {
              provider: "open-meteo",
              requestedCity: parsed.city,
            },
          },
        ],
      });

      return {
        toolMessage: {
          role: "tool",
          content: summary,
          toolCallId,
          toolName: "get_weather_snapshot",
          toolResults: [toolResult],
          metadata: createToolMessageMetadata({
            city: parsed.city,
            unit: parsed.unit,
            source: "open-meteo",
            timezone: weather.timezone,
          }),
        },
        agentStep: {
          id: createId("step"),
          status: "completed",
          kind: "tool",
          label: `查询天气：${parsed.city}`,
          payload: {
            toolName: "get_weather_snapshot",
            arguments: parsed,
            source: "open-meteo",
            summary,
          },
          createdAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    name: "search_knowledge_base",
    displayName: "知识库检索",
    description: "搜索当前应用维护的知识库记录，返回最相关的内容和来源。",
    category: "knowledge",
    riskLevel: "low",
    source: "knowledge-repository",
    timeoutMs: 3_000,
    retryable: true,
    parameters: knowledgeSchema,
    async execute(args, toolCallId) {
      const parsed = knowledgeSchema.parse(args);
      const matches = await searchKnowledgeBase(parsed.query);

      const summary =
        matches.length > 0
          ? `知识库命中 ${matches.length} 条与“${parsed.query}”相关的记录。`
          : `知识库中没有命中与“${parsed.query}”相关的记录。`;

      const result =
        matches.length > 0
          ? matches
              .map(
                (entry, index) =>
                  `${index + 1}. ${entry.title}\n标签：${
                    entry.tags.join("、") || "无"
                  }\n内容：${entry.content}`,
              )
              .join("\n\n")
          : summary;

      const sources =
        matches.length > 0
          ? matches.map((entry, index) => ({
              id: entry.id,
              title: entry.title,
              sourceType: "knowledge" as const,
              snippet: entry.content.slice(0, 140),
              tags: entry.tags,
              confidence: Math.max(0.5, 1 - index * 0.12),
              citationLabel: `KB-${index + 1}`,
              originTool: "search_knowledge_base",
              updatedAt:
                typeof entry.updatedAt === "string"
                  ? entry.updatedAt
                  : entry.updatedAt.toISOString(),
            }))
          : null;

      const toolResult = createToolResult({
        toolCallId,
        toolName: "search_knowledge_base",
        result,
        summary,
        raw: {
          query: parsed.query,
          resultCount: matches.length,
          matches,
        },
        display: {
          kind: "knowledge",
          layout: matches.length > 0 ? "list" : "status",
          title: `知识库检索：${parsed.query}`,
          body: summary,
          items:
            matches.length > 0
              ? matches.map((entry) =>
                  `${entry.title}${entry.tags.length ? ` · ${entry.tags.join("、")}` : ""}`,
                )
              : ["暂未命中结果"],
          tone: matches.length > 0 ? "info" : "warning",
        },
        sources,
      });

      return {
        toolMessage: {
          role: "tool",
          content: summary,
          toolCallId,
          toolName: "search_knowledge_base",
          toolResults: [toolResult],
          metadata: createToolMessageMetadata({
            query: parsed.query,
            resultCount: matches.length,
            source: "knowledge-repository",
            sources,
          }),
        },
        agentStep: {
          id: createId("step"),
          status: "completed",
          kind: "tool",
          label: `搜索知识库：${parsed.query}`,
          payload: {
            toolName: "search_knowledge_base",
            arguments: parsed,
            resultCount: matches.length,
            sourceTitles: matches.map((entry) => entry.title),
          },
          createdAt: new Date().toISOString(),
        },
      };
    },
  },
];

function createFailedToolExecution(
  name: string,
  args: Record<string, unknown>,
  toolCallId: string,
  error: unknown,
): ToolExecution {
  const message = error instanceof Error ? error.message : `工具 ${name} 执行失败。`;
  const result = `工具 ${name} 执行失败：${message}`;
  const toolDefinition = tools.find((tool) => tool.name === name);

  const toolResult = createToolResult({
    toolCallId,
    toolName: name,
    result,
    display: {
      kind: "generic",
      layout: "status",
      title: "工具执行失败",
      body: message,
      tone: "danger",
    },
    raw: {
      arguments: args,
      errorMessage: message,
    },
    sources:
      toolDefinition
        ? [
            {
              title: toolDefinition.displayName,
              sourceType: "tool",
              confidence: 1,
              citationLabel: "ERR-1",
              originTool: name,
              meta: {
                source: toolDefinition.source,
                category: toolDefinition.category,
              },
            },
          ]
        : null,
  });

  return {
    toolMessage: {
      role: "tool",
      content: result,
      toolCallId,
      toolName: name,
      toolResults: [toolResult],
      metadata: {
        error: true,
        visibility: "visible",
        arguments: args,
      },
    },
    agentStep: {
      id: createId("step"),
      status: "failed",
      kind: "tool",
      label: `工具执行失败：${name}`,
      payload: {
        toolName: name,
        arguments: args,
        errorMessage: message,
      },
      createdAt: new Date().toISOString(),
    },
  };
}

export function getToolCatalog() {
  return tools.map((tool) => ({
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description,
    category: tool.category,
    riskLevel: tool.riskLevel,
    source: tool.source,
    timeoutMs: tool.timeoutMs ?? null,
    retryable: tool.retryable ?? false,
  }));
}

export function getToolDefinition(name: string) {
  return tools.find((item) => item.name === name) ?? null;
}

export function getOpenAITools() {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.parameters),
    },
  }));
}

export async function runToolByName(
  name: string,
  args: Record<string, unknown>,
  toolCallId: string,
) {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    return createFailedToolExecution(
      name,
      args,
      toolCallId,
      new Error(`未注册工具：${name}`),
    );
  }

  try {
    return await tool.execute(args, toolCallId);
  } catch (error) {
    return createFailedToolExecution(name, args, toolCallId, error);
  }
}
