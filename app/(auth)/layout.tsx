export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="flex min-h-screen w-full items-center bg-[var(--app-canvas)] p-3 sm:p-6 lg:p-8"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {children}
    </div>
  );
}
