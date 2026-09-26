"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, ArrowLeft, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

const setupSchema = z.object({
  college: z.string().min(2, "College/University is required"),
  stream: z.string().min(2, "Stream is required"),
  course: z.string().min(2, "Course is required"),
  year: z.string().min(1, "Year is required"),
  tags: z.array(z.string()),
})

type SetupFormValues = z.infer<typeof setupSchema>

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
  }),
}

export default function SetupPage() {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [currentTag, setCurrentTag] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      college: "",
      stream: "",
      course: "",
      year: "",
      tags: [],
    },
  })

  // Pre-fill form with existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data } = await supabase
        .from("users")
        .select("college, stream, course, year, tags")
        .eq("id", user.id)
        .maybeSingle()

      if (data) {
        form.reset({
          college: data.college ?? "",
          stream: data.stream ?? "",
          course: data.course ?? "",
          year: data.year ?? "",
          tags: data.tags ?? [],
        })
      }
      setIsFetching(false)
    }

    loadProfile()
  }, [])

  const formTags = form.watch("tags")

  const handleSkip = () => {
    router.push("/profile")
  }

  const handleNext = async () => {
    let isValid = false
    if (step === 1) {
      isValid = await form.trigger(["college", "stream"])
    } else if (step === 2) {
      isValid = await form.trigger(["course", "year"])
    }

    if (isValid) {
      setDirection(1)
      setStep((s) => s + 1)
    }
  }

  const handleBack = () => {
    setDirection(-1)
    setStep((s) => s - 1)
  }

  const handleAddTag = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    if (!currentTag.trim()) return
    const tags = form.getValues("tags")
    if (!tags.includes(currentTag.trim())) {
      form.setValue("tags", [...tags, currentTag.trim()])
    }
    setCurrentTag("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault() // prevent form submission on enter
      if (step === 3) handleAddTag(e)
    }
  }

  const removeTag = (tagToRemove: string) => {
    form.setValue(
      "tags",
      form.getValues("tags").filter((t) => t !== tagToRemove)
    )
  }

  const onSubmit = async (data: SetupFormValues) => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { error } = await supabase
        .from("users")
        .upsert({
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
          email: user.email,
          college: data.college,
          stream: data.stream,
          course: data.course,
          year: data.year,
          tags: data.tags,
        })

      if (error) {
        console.error("Profile update failed:", error)
      }
    }

    router.push("/profile")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Memphis Background */}
      <div className="absolute top-[10%] left-[5%] w-32 h-32 rounded-full border-[2px] border-foreground bg-[#FFD600] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-40 h-40 rotate-[12deg] border-[2px] border-foreground bg-[#0057FF] pointer-events-none" />
      <div className="absolute top-[20%] right-[15%] w-16 h-16 rotate-[45deg] border-[2px] border-foreground bg-[#FF3CAC] pointer-events-none" />

      <div className="w-full max-w-2xl bg-card border-[3px] border-foreground shadow-[8px_8px_0px_black] rounded-[32px] p-8 md:p-12 relative z-10">
        <div className="absolute top-8 right-8">
          <button
            onClick={handleSkip}
            type="button"
            className="px-4 py-2 flex items-center justify-center gap-2 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:bg-background hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        <div className="mb-8">
          <h1 className="font-heading font-extrabold text-[36px] text-foreground mb-2 leading-none">
            Build your Profile
          </h1>
          <p className="font-sans text-[16px] text-muted-foreground">
            Let your campus know who you are.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3 w-12 rounded-full border-[2px] border-foreground transition-colors duration-300 ${
                step >= i ? "bg-[#FFD600]" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="min-h-[260px] relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute inset-0"
            >
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="college">College / University</Label>
                    <Input
                      id="college"
                      placeholder="e.g. Oxford University"
                      onKeyDown={handleKeyDown}
                      {...form.register("college")}
                      className={form.formState.errors.college ? "border-[#FF3B30]" : ""}
                    />
                    {form.formState.errors.college && (
                      <p className="font-sans text-[14px] text-[#FF3B30]">
                        {form.formState.errors.college.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stream">Stream / Department</Label>
                    <Input
                      id="stream"
                      placeholder="e.g. Computer Science"
                      onKeyDown={handleKeyDown}
                      {...form.register("stream")}
                      className={form.formState.errors.stream ? "border-[#FF3B30]" : ""}
                    />
                    {form.formState.errors.stream && (
                      <p className="font-sans text-[14px] text-[#FF3B30]">
                        {form.formState.errors.stream.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="course">Course</Label>
                    <Input
                      id="course"
                      placeholder="e.g. B.Tech / MSc"
                      onKeyDown={handleKeyDown}
                      {...form.register("course")}
                      className={form.formState.errors.course ? "border-[#FF3B30]" : ""}
                    />
                    {form.formState.errors.course && (
                      <p className="font-sans text-[14px] text-[#FF3B30]">
                        {form.formState.errors.course.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year of Study</Label>
                    <Input
                      id="year"
                      placeholder="e.g. 1st Year / Senior"
                      onKeyDown={handleKeyDown}
                      {...form.register("year")}
                      className={form.formState.errors.year ? "border-[#FF3B30]" : ""}
                    />
                    {form.formState.errors.year && (
                      <p className="font-sans text-[14px] text-[#FF3B30]">
                        {form.formState.errors.year.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="tags">Interest Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tags"
                        placeholder="e.g. Machine Learning"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <Button type="button" onClick={handleAddTag} className="px-4 shrink-0">
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="font-sans text-[12px] text-muted-foreground/70 mt-1">
                      Press enter or click &apos;+&apos; to add to your interests.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    {formTags.map((tag) => (
                      <div
                        key={tag}
                        className="bg-[#FFD600] border-[1.5px] border-foreground shadow-[3px_3px_0px_black] px-3 py-1.5 rounded-full flex items-center gap-1"
                      >
                        <span className="font-mono text-[12px] font-medium leading-none mt-[2px]">{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {formTags.length === 0 && (
                      <p className="font-sans text-[14px] text-muted-foreground italic">No tags added yet.</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-12 flex justify-between items-center pt-6 border-t-[2px] border-border">
          {step > 1 ? (
            <button 
              onClick={handleBack} 
              type="button"
              className="px-5 py-2.5 flex items-center justify-center gap-2 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:bg-background hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div /> // Spacer
          )}

          {step < 3 ? (
            <Button onClick={handleNext} type="button">
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Profile
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
