import { z } from "zod";

import { searchKnowledgeBase } from "@/lib/repositories/chat-repository";
import { createId } from "@/lib/utils";
import type {
  AgentStep,
  ChatMessageMetadata,
  ToolResultRecord,
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

type ToolDefinition = {
  name: string;
  description: string;
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
    interval?: number;
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
  return [result.name, result.admin1, result.country]
    .filter(Boolean)
    .join(" / ");
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
  const geocodingUrl = new URL(
    "https://geocoding-api.open-meteo.com/v1/search",
  );
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

  const weather = await fetchJson<OpenMeteoWeatherResponse>(
    weatherUrl.toString(),
  );
  const current = weather.current;

  if (!current) {
    throw new Error(`天气接口未返回当前天气：${city}`);
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

const tools: ToolDefinition[] = [
  {
    name: "get_current_time",
    description: "获取指定 IANA 时区的当前时间。",
    parameters: currentTimeSchema,
    async execute(args, toolCallId) {
      const parsed = currentTimeSchema.parse(args);
      const formatted = new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: parsed.timezone,
      }).format(new Date());
      const result = `${parsed.timezone} 当前时间：${formatted}`;

      return {
        toolMessage: {
          role: "tool",
          content: result,
          toolCallId,
          toolName: "get_current_time",
          toolResults: [{ toolCallId, toolName: "get_current_time", result }],
          metadata: {
            timezone: parsed.timezone,
            liveData: true,
            visibility: "visible",
          },
        },
        agentStep: {
          id: createId("step"),
          status: "completed",
          kind: "tool",
          label: `查询时区时间：${parsed.timezone}`,
          payload: { toolName: "get_current_time", arguments: parsed, result },
          createdAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    name: "get_weather_snapshot",
    description: "获取指定城市的实时天气快照。",
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

      const result = [
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
        weather.windDirection !== null ? `风向 ${weather.windDirection}°` : null,
        weather.observedAt ? `观测时间 ${weather.observedAt}` : null,
      ]
        .filter(Boolean)
        .join("，");

      return {
        toolMessage: {
          role: "tool",
          content: result,
          toolCallId,
          toolName: "get_weather_snapshot",
          toolResults: [
            { toolCallId, toolName: "get_weather_snapshot", result },
          ],
          metadata: {
            city: parsed.city,
            unit: parsed.unit,
            liveData: true,
            source: "open-meteo",
            timezone: weather.timezone,
            visibility: "visible",
          },
        },
        agentStep: {
          id: createId("step"),
          status: "completed",
          kind: "tool",
          label: `查询实时天气：${parsed.city}`,
          payload: {
            toolName: "get_weather_snapshot",
            arguments: parsed,
            source: "open-meteo",
            liveData: true,
          },
          createdAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    name: "search_knowledge_base",
    description: "搜索当前应用维护的知识库记录，返回最相关的内容和来源。",
    parameters: knowledgeSchema,
    async execute(args, toolCallId) {
      const parsed = knowledgeSchema.parse(args);
      const matches = await searchKnowledgeBase(parsed.query);
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
          : `没有命中与“${parsed.query}”相关的知识库条目。`;

      return {
        toolMessage: {
          role: "tool",
          content: result,
          toolCallId,
          toolName: "search_knowledge_base",
          toolResults: [
            { toolCallId, toolName: "search_knowledge_base", result },
          ],
          metadata: {
            query: parsed.query,
            resultCount: matches.length,
            liveData: true,
            visibility: "visible",
            sources: matches.map((entry) => ({
              id: entry.id,
              title: entry.title,
              tags: entry.tags,
            })),
          },
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

  return {
    toolMessage: {
      role: "tool",
      content: result,
      toolCallId,
      toolName: name,
      toolResults: [{ toolCallId, toolName: name, result }],
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
