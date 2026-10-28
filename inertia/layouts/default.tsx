import { toast, Toaster } from 'sonner'
import { usePage } from '@inertiajs/react'
import { type ReactElement, useEffect } from 'react'
import { syncThemeColor } from '@/lib/theme'

export default function Layout({ children }: { children: ReactElement }) {
  const { url, flash } = usePage()

  /*
   * La couleur du cadre de la fenêtre autonome. Ici plutôt que dans le
   * tableau de bord : le paramétrage s'ouvre aussi dans l'application
   * installée, et il n'applique aucun thème lui-même.
   */
  useEffect(syncThemeColor, [])

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash.error) toast.error(flash.error)
    if (flash.success) toast.success(flash.success)
  })

  return (
    <>
      <div className="min-h-screen">{children}</div>
      <Toaster position="top-center" richColors />
    </>
  )
}
