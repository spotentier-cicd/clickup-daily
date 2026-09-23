import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">clickup-daily</h1>
      <p className="mt-2 text-muted-foreground">
        Socle en place : AdonisJS 7, Inertia, React 19, Tailwind v4, shadcn/ui.
      </p>
      <div className="mt-8 flex gap-3">
        <Button>Bouton shadcn</Button>
        <Button variant="outline">Variante outline</Button>
      </div>
    </div>
  )
}
