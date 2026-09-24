import { toast, Toaster } from 'sonner'
import { usePage } from '@inertiajs/react'
import { type ReactElement, useEffect } from 'react'

export default function Layout({ children }: { children: ReactElement }) {
  const { url, flash } = usePage()

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash.error) toast.error(flash.error)
    if (flash.success) toast.success(flash.success)
  })

  return (
    <>
      <main className="min-h-screen">{children}</main>
      <Toaster position="top-center" richColors />
    </>
  )
}
