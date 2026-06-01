import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "沉香 AI 助手",
  description: "面向沉香文博馆与高端品牌的 AI 导览、百科问答与导购转化 MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
