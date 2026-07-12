"use client";

import { useState } from "react";
import { EyeOff, Eye, Truck, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login
    router.push("/");
  };

  return (
    <div className="flex flex-row w-full h-screen overflow-hidden bg-surface font-body-md text-on-surface">
      {/* Left Panel: Brand & Visuals */}
      <div className="hidden lg:flex flex-col w-7/12 relative bg-primary overflow-hidden">
        {/* Decorative Background elements */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary-container/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-5%] right-[-5%] w-[400px] h-[400px] bg-secondary-container/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full p-xl">
          <div className="flex items-center gap-sm">
            <div className="bg-on-primary p-xs rounded-lg shadow-xl">
              <Truck className="text-primary h-8 w-8" />
            </div>
            <span className="font-display-lg text-headline-lg text-on-primary tracking-tight">
              TransitOps
            </span>
          </div>

          <div className="max-w-xl">
            <h1 className="font-display-lg text-display-lg text-on-primary mb-md leading-tight">
              Digitize your <br />
              <span className="text-secondary-container">fleet operations.</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-primary/80 max-w-md">
              The intelligent command center for modern logistics. Track, manage, and optimize your entire transit network in real-time.
            </p>
          </div>

          <div className="flex items-center gap-lg mt-xl">
            <p className="font-caption text-caption text-on-primary/60">
              Trusted by 500+ global logistics partners
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-surface relative">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-xl left-xl flex items-center gap-xs">
          <Truck className="text-primary h-6 w-6" />
          <span className="font-headline-md text-headline-md text-on-surface tracking-tight">
            TransitOps
          </span>
        </div>

        <div className="w-full max-w-[420px] px-margin-mobile lg:px-0">
          <div className="mb-xl">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">
              Welcome back
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Enter your credentials to access your dashboard
            </p>
          </div>

          <form className="space-y-lg" onSubmit={handleLogin}>
            <div className="space-y-xs">
              <label className="font-caption text-caption text-on-surface-variant uppercase tracking-wider" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`w-full px-md py-lg bg-surface-container-low rounded-lg text-on-surface font-body-md border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${error ? 'border-error' : 'border-outline-variant focus:border-primary'}`}
                  placeholder="name@company.com"
                  defaultValue="admin@transitops.io"
                />
              </div>
            </div>

            <div className="space-y-xs">
              <div className="flex justify-between items-center">
                <label className="font-caption text-caption text-on-surface-variant uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <a href="#" className="font-caption text-caption text-primary hover:text-primary-container transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className={`w-full px-md py-lg pr-12 bg-surface-container-low rounded-lg text-on-surface font-body-md border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${error ? 'border-error' : 'border-outline-variant focus:border-primary'}`}
                  defaultValue="password123"
                />
                <button
                  type="button"
                  className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
              
              {error && (
                <div className="flex items-center gap-xs mt-sm text-error">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-caption text-caption">Invalid email or password</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-title-md text-body-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              Sign in to Dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
