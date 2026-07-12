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
    <main className="flex min-h-screen items-center justify-center bg-surface p-6 text-on-surface">
      <div className="w-full" style={{ width: "min(420px, calc(100vw - 48px))" }}>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Truck className="h-5 w-5" />
          </div>
          <span className="font-headline-md text-headline-md text-primary">TransitOps</span>
        </div>

        <div className="mb-8">
          <h1 className="font-headline-lg text-headline-lg">Create account</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Set up access to the operations workspace.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <label className="block space-y-2">
            <span className="text-label-md font-medium">Name</span>
            <input name="name" required className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20" />
          </label>
          <label className="block space-y-2">
            <span className="text-label-md font-medium">Email</span>
            <input name="email" type="email" required className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20" />
          </label>
          <label className="block space-y-2">
            <span className="text-label-md font-medium">Password</span>
            <input name="password" type="password" minLength={6} required className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20" />
          </label>
          <label className="block space-y-2">
            <span className="text-label-md font-medium">Role</span>
            <select name="role" defaultValue="FLEET_MANAGER" className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20">
              <option value="FLEET_MANAGER">Fleet Manager</option>
              <option value="DISPATCHER">Dispatcher</option>
              <option value="SAFETY_OFFICER">Safety Officer</option>
              <option value="FINANCIAL_ANALYST">Financial Analyst</option>
            </select>
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
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-lg font-label-lg text-on-primary hover:bg-primary/90 disabled:opacity-70"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
