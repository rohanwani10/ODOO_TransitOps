"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Truck } from "lucide-react";

function getErrorMessage(data: unknown) {
  if (typeof data !== "object" || data === null) return "Unable to create account";
  const error = (data as { error?: unknown }).error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === "string") return error;
  return "Unable to create account";
}

export default function SignupPage() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role"),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(getErrorMessage(data));
        return;
      }

      router.push("/login");
    } catch {
      setError("Unable to create account right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-single">
      <div className="auth-single-card">
        <div className="auth-logo mb-8">
          <div className="auth-logo-mark auth-logo-mark-sm">
            <Truck className="h-5 w-5" aria-hidden="true" />
          </div>
          <span>TransitOps</span>
        </div>

        <div className="auth-heading">
          <h1 className="auth-form-title">Create account</h1>
          <p className="auth-muted">
            Set up access to the operations workspace.
          </p>
        </div>

        <form onSubmit={handleSignup} className="auth-form">
          <label className="auth-field">
            <span className="auth-label">Name</span>
            <input name="name" required className="auth-control" />
          </label>
          <label className="auth-field">
            <span className="auth-label">Email</span>
            <input name="email" type="email" required className="auth-control" />
          </label>
          <label className="auth-field">
            <span className="auth-label">Password</span>
            <input name="password" type="password" minLength={6} required className="auth-control" />
          </label>
          <label className="auth-field">
            <span className="auth-label">Role</span>
            <select name="role" defaultValue="FLEET_MANAGER" className="auth-control">
              <option value="FLEET_MANAGER">Fleet Manager</option>
              <option value="DISPATCHER">Dispatcher</option>
              <option value="SAFETY_OFFICER">Safety Officer</option>
              <option value="FINANCIAL_ANALYST">Financial Analyst</option>
            </select>
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
            Create account
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
