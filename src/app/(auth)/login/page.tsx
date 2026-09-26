"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const watchedEmail = form.watch("email")
  const watchedPassword = form.watch("password")
  const signupUrl = `/signup?email=${encodeURIComponent(watchedEmail || "")}&password=${encodeURIComponent(watchedPassword || "")}`

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    setErrorText(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    
    if (error) {
      setErrorText(error.message)
      setIsLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  async function onGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }

  return (
    <div className="bg-card p-8 rounded-[24px] border-[2px] border-foreground shadow-[4px_4px_0px_black]">
      <div className="mb-8">
        <h2 className="font-heading font-bold text-[28px] text-foreground mb-2">Welcome Back</h2>
        <p className="font-sans text-[16px] text-muted-foreground">Enter your details to access your vault.</p>
      </div>

      <div className="space-y-6">
        <Button variant="secondary" className="w-full" onClick={onGoogleSignIn} type="button">
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Sign in with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-card px-2 font-mono text-muted-foreground/70">OR CONTINUE WITH</span>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input 
              id="email" 
              placeholder="name@college.edu" 
              {...form.register("email")}
              className={form.formState.errors.email ? "border-[#FF3B30]" : ""}
            />
            {form.formState.errors.email && (
              <p className="font-sans text-[14px] text-[#FF3B30]">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/reset" className="font-mono text-[12px] text-foreground underline hover:text-muted-foreground">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                {...form.register("password")}
                className={form.formState.errors.password ? "border-[#FF3B30] pr-10" : "pr-10"}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="font-sans text-[14px] text-[#FF3B30]">{form.formState.errors.password.message}</p>
            )}
          </div>

          {errorText && (
            <div className="bg-[#FF3B30] text-white p-3 rounded-[12px] text-[14px] font-sans border-[2px] border-foreground">
              {errorText}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log In
          </Button>
        </form>
      </div>

      <div className="mt-8 text-center font-sans text-[14px] text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={signupUrl} className="text-foreground font-bold hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  )
}
