"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { loginSchema, type LoginInput } from "@/lib/validators/auth"

export default function LoginPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const router = useRouter()
  const { login, user, loading } = useAuth()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard")
    }
  }, [loading, router, user])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await login(values.email, values.password)
      router.replace("/dashboard")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось выполнить вход. Попробуйте позже."
      setSubmitError(message)
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-card-foreground">Вход в корпоративный портал</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Введите ваш рабочий email и пароль для продолжения.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@almacorgroup.ru"
              autoComplete="email"
              aria-label="Email"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder="Введите пароль"
              autoComplete="current-password"
              aria-label="Пароль"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting || loading}
          >
            {form.formState.isSubmitting ? "Выполняется вход..." : "Войти"}
          </Button>
        </form>
      </Card>
    </main>
  )
}
