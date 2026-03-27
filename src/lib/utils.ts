import { useMobileMenu } from "@/hooks/useMobileMenu";
import { useSignOut } from "@/hooks/useSignOut";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}