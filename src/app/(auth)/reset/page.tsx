"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

const resetSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
})

type ResetFormValues = z.infer<typeof resetSchema>

export default function ResetPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(data: ResetFormValues) {
    setIsLoading(true)
    setErrorText(null)
    
    // We send a password-reset email with a redirect
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password-confirm`,
    })
    
    if (error) {
      setErrorText(error.message)
      setIsLoading(false)
    } else {
      setSuccess(true)
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-card p-8 rounded-[24px] border-[2px] border-foreground shadow-[4px_4px_0px_black] text-center">
        <h2 className="font-heading font-bold text-[28px] text-foreground mb-4">Check your email</h2>
        <p className="font-sans text-[16px] text-muted-foreground mb-6">
          If an account exists for that email, we have sent a password reset link.
        </p>
        <Link 
          href="/login"
          className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:bg-background hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-card p-8 rounded-[24px] border-[2px] border-foreground shadow-[4px_4px_0px_black]">
      <Link 
        href="/login" 
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:bg-background hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      <div className="mb-8">
        <h2 className="font-heading font-bold text-[28px] text-foreground mb-2">Reset Password</h2>
        <p className="font-sans text-[16px] text-muted-foreground">Enter your email to receive a password reset link.</p>
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

        {errorText && (
          <div className="bg-[#FF3B30] text-white p-3 rounded-[12px] text-[14px] font-sans border-[2px] border-foreground">
            {errorText}
          </div>
        )}

        <Button type="submit" className="w-full mt-2" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Reset Link
        </Button>
      </form>
    </div>
  )
}
