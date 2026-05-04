import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { Dashboard } from "@/components/pages/dashboard"
import { EmployeeDirectory } from "@/components/pages/employee-directory"
import { Documents } from "@/components/pages/documents"
import { Profile } from "@/components/pages/profile"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/documents",
  useSearchParams: () => new URLSearchParams(),
}))

describe("Home smoke", () => {
  it("renders dashboard content", async () => {
    const data = await mockPortalRepository.getDashboardData()
    render(<Dashboard data={data} />)

    expect(screen.getByText("Добрый день, Иван!")).toBeInTheDocument()
    expect(screen.getByText("Последние новости")).toBeInTheDocument()
  })

  it("renders employee directory", async () => {
    const data = await mockPortalRepository.getContactsData()
    render(<EmployeeDirectory data={data} />)

    expect(screen.getByText("Справочник сотрудников")).toBeInTheDocument()
    expect(screen.getByText(/Всего в организации/i)).toBeInTheDocument()
  })

  it("renders documents and profile sections", async () => {
    const documentsData = await mockPortalRepository.getDocumentsData()
    render(<Documents data={documentsData} />)
    expect(screen.getByRole("heading", { name: "Документы" })).toBeInTheDocument()

    const profileData = await mockPortalRepository.getProfileData()
    render(<Profile data={profileData} />)
    expect(screen.getByRole("heading", { name: "Иван Петров" })).toBeInTheDocument()
    expect(screen.getByText("Мой профиль")).toBeInTheDocument()
  })
})
