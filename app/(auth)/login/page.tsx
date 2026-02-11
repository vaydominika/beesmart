"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "OAuthAccountNotLinked") {
      toast.error(
        "This email is already registered with a password. Sign in with your password below, or use the same method you used to create your account."
      );
    } else if (error === "CredentialsSignin") {
      toast.error("Invalid email or password.");
    } else if (error) {
      toast.error("Sign-in failed. Please try again.");
    }
  }, [searchParams]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        toast.error("Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4">
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
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3"
              >
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[18px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3"
              >
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[18px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                placeholder="••••••••"
              />
            </div>
            <FancyButton
              type="submit"
              disabled={loading}
              className="w-full h-10 md:h-12 text-(--theme-text-important) bg-(--theme-sidebar) font-semibold uppercase text-[28px]"
            >
              {loading ? "Signing in…" : "Sign in"}
            </FancyButton>
          </form>
        </div>
      </FancyCard>
      <p className="text-sm text-(--theme-text)">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-(--theme-secondary) underline hover:no-underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-(--theme-text)">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
