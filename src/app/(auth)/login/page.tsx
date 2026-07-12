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
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-logo">
            <div className="auth-logo-mark">
              <Truck className="h-6 w-6" aria-hidden="true" />
            </div>
            <span>TransitOps</span>
          </div>

          <div className="auth-brand-copy">
            <p className="auth-kicker">Operations command center</p>
            <h1 className="auth-title">
              Manage vehicles, drivers, trips, maintenance, and fleet expenses from one live workspace.
            </h1>
          </div>

          <div className="auth-feature-grid">
            <div className="auth-feature">Live dashboard</div>
            <div className="auth-feature">Fleet records</div>
            <div className="auth-feature">Cost tracking</div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-logo mb-8 lg:hidden">
              <div className="auth-logo-mark auth-logo-mark-sm">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </div>
              <span>TransitOps</span>
            </div>

            <div className="auth-heading">
              <h2 className="auth-form-title">Sign in</h2>
              <p className="auth-muted">
                Access your operations dashboard.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleLogin}>
              <label className="auth-field">
                <span className="auth-label">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="auth-control"
                  placeholder="admin@transitops.com"
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">Password</span>
                <div className="auth-password-wrap">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="auth-control"
                    placeholder="Admin@123"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="auth-password-button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              {error && (
                <div className="auth-error">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="auth-submit"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </button>
            </form>

            <p className="auth-switch">
              No account yet?{" "}
              <Link href="/signup" className="auth-link">
                Create one
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
