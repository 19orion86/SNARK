import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import LoginPage from "@/app/(auth)/login/page"
import { AuthProvider, useAuth } from "@/hooks/use-auth"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

const server = setupServer()

function AuthProbe() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p data-testid="auth-state">loading</p>
  }

  if (!user) {
    return <p data-testid="auth-state">anonymous</p>
  }

  return <p data-testid="auth-state">{user.email}</p>
}

describe("Login page e2e client flow", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }))

  afterEach(() => {
    server.resetHandlers()
    replaceMock.mockReset()
  })

  afterAll(() => server.close())

  it("redirects to /dashboard and updates auth state on successful login", async () => {
    server.use(
      http.post("*/api/auth/refresh", () =>
        HttpResponse.json({ error: "Сессия недействительна" }, { status: 401 })
      ),
      http.post("*/api/auth/login", async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string }

        if (body.email === "test@almacorgroup.ru" && body.password === "Test123456") {
          return HttpResponse.json({
            accessToken: "access-token",
            user: {
              id: "user-1",
              email: body.email,
              firstName: "Тест",
              lastName: "Пользователь",
              role: "employee",
              departmentId: null,
              isActive: true,
            },
            role: "employee",
          })
        }

        return HttpResponse.json({ error: "Неверный email или пароль" }, { status: 401 })
      })
    )

    render(
      <AuthProvider>
        <LoginPage />
        <AuthProbe />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Войти" })).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@almacorgroup.ru" },
    })
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "Test123456" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Войти" }))

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard")
    })

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent("test@almacorgroup.ru")
    })
  })

  it("shows russian error on invalid credentials", async () => {
    server.use(
      http.post("*/api/auth/refresh", () =>
        HttpResponse.json({ error: "Сессия недействительна" }, { status: 401 })
      ),
      http.post("*/api/auth/login", () =>
        HttpResponse.json({ error: "Неверный email или пароль" }, { status: 401 })
      )
    )

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Войти" })).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@almacorgroup.ru" },
    })
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "WrongPassword123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Войти" }))

    await waitFor(() => {
      expect(screen.getByText("Неверный email или пароль")).toBeInTheDocument()
    })
  })
})
