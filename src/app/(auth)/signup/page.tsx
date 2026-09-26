"use client"

import { useState, useEffect } from "react"
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

const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const password = params.get('password')
    if (email) form.setValue("email", email)
    if (password) form.setValue("password", password)
  }, [form])

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true)
    setErrorText(null)
    
    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      }
    })
    
    if (signUpError) {
      setErrorText(signUpError.message)
      setIsLoading(false)
    } else {
      router.push("/setup")
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
        <h2 className="font-heading font-bold text-[28px] text-foreground mb-2">Create Account</h2>
        <p className="font-sans text-[16px] text-muted-foreground">Join your campus community on MODULUS.</p>
      </div>

      <div className="space-y-6">
        <Button variant="secondary" className="w-full" onClick={onGoogleSignIn} type="button">
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Sign up with Google
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
          <Label htmlFor="name">Full Name</Label>
          <Input 
            id="name" 
            placeholder="John Doe" 
            {...form.register("name")}
            className={form.formState.errors.name ? "border-[#FF3B30]" : ""}
          />
          {form.formState.errors.name && (
            <p className="font-sans text-[14px] text-[#FF3B30]">{form.formState.errors.name.message}</p>
          )}
        </div>
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
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input 
              id="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="Min. 8 characters" 
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

        <Button type="submit" className="w-full mt-2" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Join MODULUS
        </Button>
      </form>
      </div>

      <div className="mt-8 text-center font-sans text-[14px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-bold hover:underline">
          Log in
        </Link>
      </div>
    </div>
  )
}
