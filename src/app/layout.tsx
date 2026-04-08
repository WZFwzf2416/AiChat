import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "从 Chat 到 Agent 的练习场",
  description:
    "一个面向前端开发者的 AI Chat 学习工作台，支持真实联调、工具调用和向 Agent 架构演进。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
