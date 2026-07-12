"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Truck } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

function readError(data: unknown) {
  if (typeof data !== "object" || data === null) return "Invalid email or password";
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Invalid email or password";
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(readError(data));
        return;
      }

      setAuth(data.data.user, data.data.accessToken);
      router.push("/");
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[1fr_440px]">
        <section className="hidden flex-col justify-between border-r border-outline-variant/30 bg-surface-container-low p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Truck className="h-6 w-6" />
            </div>
            <span className="font-headline-lg text-headline-lg text-primary">TransitOps</span>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 text-label-lg font-label-lg text-primary">Operations command center</p>
            <h1 className="font-display-lg text-display-md leading-tight text-on-surface">
              Manage vehicles, drivers, trips, maintenance, and fleet expenses from one live workspace.
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-4 text-body-sm text-on-surface-variant">
            <div className="rounded-lg border border-outline-variant/30 bg-surface p-4">Live dashboard</div>
            <div className="rounded-lg border border-outline-variant/30 bg-surface p-4">Fleet records</div>
            <div className="rounded-lg border border-outline-variant/30 bg-surface p-4">Cost tracking</div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full" style={{ width: "min(420px, calc(100vw - 48px))" }}>
            <div className="mb-8 lg:hidden">
              <div className="mb-4 flex items-center gap-2">
                <Truck className="h-7 w-7 text-primary" />
                <span className="font-headline-md text-headline-md text-primary">TransitOps</span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Sign in</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Access your operations dashboard.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <label className="block space-y-2">
                <span className="text-label-md font-medium text-on-surface">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-body-md outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                  placeholder="admin@transitops.com"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-label-md font-medium text-on-surface">Password</span>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 pr-11 text-body-md outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                    placeholder="Admin@123"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-lg font-label-lg text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-70"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </button>
            </form>

            <p className="mt-6 text-center text-body-sm text-on-surface-variant">
              No account yet?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
