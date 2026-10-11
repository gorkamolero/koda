import type { Meta, StoryObj } from '@storybook/react-vite'
import { KodaLogo, Spinner, TerminalSection, WorkingIndicator } from '../brand'
import { Button, Kbd } from '../primitives'

function BrandPage() {
  return <main className="mx-auto max-w-4xl space-y-10 p-8 font-code text-text-primary">
    <header className="space-y-4"><p className="text-xs uppercase tracking-widest text-text-secondary">Koda / Brand</p><KodaLogo size="lg" /><h1 className="text-xl">Quiet surfaces. Explicit actions.</h1><p className="max-w-2xl text-sm text-text-secondary">The ASCII mark, mono-first type, terminal frames and bracket labels come from the working desktop. Warm accents identify activity without overpowering the work.</p></header>
    <TerminalSection title="Actions" description="Brackets are the action's visual grammar. Use a clear verb and keep keyboard hints adjacent."><div className="flex flex-wrap items-center gap-4"><Button variant="bracket">Share workspace</Button><Button variant="bracket">Review changes</Button><Kbd>⌘K</Kbd></div></TerminalSection>
    <TerminalSection title="In motion" description="Koda's letter animations communicate waiting; the status is also announced to assistive technology."><div className="flex flex-wrap gap-8">{(['wave', 'scan', 'pulse', 'matrix', 'bounce'] as const).map(variant => <Spinner key={variant} variant={variant} label={variant} />)}</div></TerminalSection>
    <TerminalSection title="Working"><WorkingIndicator elapsedMs={43000} label="reviewing workspace changes" /></TerminalSection>
  </main>
}
const meta = { title: 'Brand/Overview', component: BrandPage, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof BrandPage>
export default meta
type Story = StoryObj<typeof meta>
export const Identity: Story = {}
