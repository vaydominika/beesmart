"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Registration failed.");
        return;
      }
      const signInRes = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        toast.success("Account created. Please sign in.");
        router.push("/login");
        router.refresh();
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="w-full max-w-md h-[95vh] flex flex-col items-center gap-4">
      <Link href="/" className="flex items-center">
        <Image
          src="/svg/BeeSmartLogo.svg"
          alt="BeeSmart"
          width={480}
          height={192}
          className="h-25 w-auto -translate-x-2.5"
        />
      </Link>
      <FancyCard className="w-full p-6 bg-(--theme-bg) border-dashed border-4 border-(--theme-card)">
        <div className="flex flex-col gap-4">
          <FancyButton
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full h-10 md:h-12 text-(--theme-text) bg-(--theme-card) font-semibold uppercase text-[28px]"
          >
            <Image
              src="/svg/google-icon-logo-svgrepo-com.svg"
              alt="Google"
              width={24}
              height={24}
              className="h-6 w-auto mr-2"
            />
            Continue with Google
          </FancyButton>
          <div className="flex items-center gap-3">
            <Separator className="flex-1 bg-(--theme-card) border-1 border-(--theme-card)" />
            <span className="text-[22px] text-(--theme-card) opacity-90">or</span>
            <Separator className="flex-1 bg-(--theme-card) border-1 border-(--theme-card)" />
          </div>
          <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
            <div className="flex flex-row gap-4">
              <div>
                <label
                  htmlFor="register-name"
                  className="block text-sm md:text-[18px] font-bold text-(--theme-text) uppercase mb-3"
                >
                  Name
                </label>
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[18px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="register-email"
                  className="block text-sm md:text-[18px] font-bold text-(--theme-text) uppercase mb-3"
                >
                  Email
                </label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[18px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="register-password"
                className="block text-sm md:text-[18px] font-bold text-(--theme-text) uppercase mb-3"
              >
                Password
              </label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[18px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label
                htmlFor="register-confirm"
                className="block text-sm md:text-[18px] font-bold text-(--theme-text) uppercase mb-3"
              >
                Confirm password
              </label>
              <Input
                id="register-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[18px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                placeholder="••••••••"
              />
            </div>
            <FancyButton
              type="submit"
              disabled={loading}
              className="w-full h-10 md:h-12 text-(--theme-text-important) bg-(--theme-sidebar) font-semibold uppercase text-[28px]"
            >
              {loading ? "Creating account…" : "Create account"}
            </FancyButton>
          </form>
        </div>
      </FancyCard>
      <p className="text-sm text-(--theme-text)">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-(--theme-secondary) underline hover:no-underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
