import type { CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRight, GitBranch, Terminal } from 'lucide-react'
import { baseColorTokens, typography, spacing, radii, shadows, blur, motion, layers, iconSizes } from '../tokens'
import { TerminalSection, FileIcon } from '../brand'
import './foundations.css'

function Foundations({ section = 'all' }: { section?: 'all' | 'color' | 'type' | 'scales' | 'motion' | 'icons' }) {
  const show = (name: string) => section === 'all' || section === name
  const groups = ['surface', 'text', 'border', 'status', 'gray'] as const
  return <main className="mx-auto max-w-5xl space-y-8 p-6 font-code text-sm text-text-primary">
    <header><p className="mb-2 text-xs uppercase tracking-widest text-text-secondary">Koda / Foundations</p><h1 className="text-2xl font-semibold">One vocabulary. Four themes.</h1><p className="mt-3 max-w-2xl text-text-secondary">Every swatch and scale below is read from the exported tokens. Switch the theme toolbar to inspect the same semantic names in a different theme.</p></header>
    {show('color') && groups.map(group => <TerminalSection key={group} title={group}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{Object.keys(baseColorTokens).filter(name => name.startsWith(`--${group}-`)).map(name => <div key={name} className="overflow-hidden rounded-md border border-border-subtle bg-surface-card">
        <div aria-hidden="true" className="foundation-swatch h-12 border-b border-border-subtle" style={{ '--sample-color': `var(${name})` } as CSSProperties} />
        <p className="break-all p-3 text-xs text-text-primary">{name}</p>
      </div>)}</div>
    </TerminalSection>)}
    {show('type') && <TerminalSection title="Typography"><div className="space-y-4">{Object.entries(typography).map(([name, role]) => <div key={name} className="grid gap-2 border-b border-border-subtle pb-4 md:grid-cols-3"><div><h2 className="text-sm font-semibold capitalize">{name}</h2><p className="mt-1 text-xs text-text-secondary">{role.fontSize} / {role.lineHeight} / {role.letterSpacing}</p></div><div className="md:col-span-2" style={role}>{name === 'label' ? '[REVIEW CHANGES]' : name === 'code' ? 'git diff --stat HEAD' : 'A workspace for work worth reviewing.'}</div></div>)}</div></TerminalSection>}
    {show('scales') && <>
      <TerminalSection title="Spacing"><div className="space-y-2">{Object.entries(spacing).map(([step, size]) => <div key={step} className="flex items-center gap-4"><span className="w-14 shrink-0">{step}</span><div aria-hidden="true" className="foundation-spacing h-3 max-w-full bg-text-muted" style={{ '--sample-space': size } as CSSProperties} /><span className="text-text-secondary">{size}</span></div>)}</div></TerminalSection>
      <TerminalSection title="Radius"><div className="flex flex-wrap gap-6">{Object.entries(radii).map(([name, value]) => <div key={name} className="foundation-radius flex h-20 w-24 items-center justify-center border border-border-stronger bg-surface-card text-text-primary" style={{ '--sample-radius': value } as CSSProperties}>{name}</div>)}</div></TerminalSection>
      <TerminalSection title="Elevation"><div className="flex flex-wrap gap-8 p-4">{Object.entries(shadows).map(([name, value]) => <div key={name} className="foundation-shadow flex h-20 w-24 items-center justify-center rounded-md border border-border-subtle bg-surface-card" style={{ '--sample-shadow': value } as CSSProperties}>{name}</div>)}</div><div className="mt-6 flex gap-4">{Object.entries(blur).map(([name, value]) => <div key={name} className="foundation-blur rounded-md border border-border-subtle bg-surface-card p-4" style={{ '--sample-blur': value } as CSSProperties}>Blur: {name}</div>)}</div></TerminalSection>
      <TerminalSection title="Layers"><div className="flex flex-wrap gap-4">{Object.entries(layers).map(([name, value]) => <div key={name} className="rounded-md border border-border-subtle bg-surface-card p-4">{name} <strong>{value}</strong></div>)}</div></TerminalSection>
    </>}
    {show('motion') && <TerminalSection title="Motion"><p className="mb-4 text-text-secondary">Focus or hover a duration sample. All animated components respect reduced motion.</p><div className="flex flex-wrap gap-4">{Object.entries(motion.durations).map(([name, value]) => <button key={name} type="button" className="foundation-sample rounded-md border border-border-stronger bg-surface-card p-4 transition-transform hover:-translate-y-1 focus-visible:-translate-y-1" style={{ '--sample-duration': value, '--sample-easing': motion.easings.standard } as CSSProperties}>{name} / {value}<ArrowRight aria-hidden="true" className="ml-2 inline size-4" /></button>)}</div><dl className="my-6 grid grid-cols-2 gap-3">{Object.entries(motion.easings).map(([name, value]) => <div key={name}><dt>{name}</dt><dd className="text-text-secondary">{value}</dd></div>)}</dl><p className="text-text-secondary">Keyframes: {motion.animations.join(', ')}</p></TerminalSection>}
    {show('icons') && <TerminalSection title="Icons"><div className="flex flex-wrap items-center gap-8">{Object.entries(iconSizes).map(([name, size]) => <div key={name} className="flex items-center gap-3"><Terminal aria-hidden="true" size={size} /><GitBranch aria-hidden="true" size={size} /><span>{name} / {size}</span></div>)}</div><div className="mt-6 flex flex-wrap gap-6">{['App.tsx', 'tokens.css', 'package.json', 'README.md', 'main.rs'].map(filename => <span key={filename} className="inline-flex items-center gap-2"><FileIcon filename={filename} />{filename}</span>)}</div></TerminalSection>}
  </main>
}

const meta = { title: 'Foundations', component: Foundations, tags: ['autodocs'], parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Foundations>
export default meta
type Story = StoryObj<typeof meta>
export const Overview: Story = {}
export const Color: Story = { args: { section: 'color' } }
export const Type: Story = { args: { section: 'type' } }
export const Scales: Story = { args: { section: 'scales' } }
export const Motion: Story = { args: { section: 'motion' } }
export const Icons: Story = { args: { section: 'icons' } }
