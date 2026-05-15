import Image from "next/image"
import { cn } from "@/lib/utils"

export const BRAND_LOGO_SRC = "/snark-logo.svg"

interface BrandLogoProps {
  /** На тёмном фоне (шапка) — логотип на белой подложке */
  variant?: "on-dark" | "on-light"
  size?: "sm" | "md"
  className?: string
  priority?: boolean
}

const sizeClasses = {
  sm: { box: "h-8 w-8 p-1", image: 32 },
  md: { box: "h-10 w-10 p-1.5", image: 40 },
} as const

export function BrandLogo({
  variant = "on-light",
  size = "md",
  className,
  priority = false,
}: BrandLogoProps) {
  const { box, image } = sizeClasses[size]

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        box,
        variant === "on-dark" ? "bg-white" : "bg-transparent",
        className
      )}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="ПКФ Снарк"
        width={image}
        height={image}
        className="h-full w-full object-contain"
        priority={priority}
      />
    </div>
  )
}
