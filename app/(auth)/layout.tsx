export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="flex min-h-screen w-full items-start bg-[var(--app-canvas)] p-4 md:p-6"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {children}
    </div>
  );
}
