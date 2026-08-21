import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation desk",
  description: "Restricted ticket review workspace",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
