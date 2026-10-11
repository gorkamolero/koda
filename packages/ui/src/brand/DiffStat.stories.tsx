import type { Meta, StoryObj } from '@storybook/react-vite'
import { DiffStat } from './index'


const meta = { title: 'Brand/DiffStat', component: DiffStat, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { additions: 12, deletions: 3, showBar: true },  } satisfies Meta<typeof DiffStat>
export default meta
type Story = StoryObj<typeof meta>
export const Mixed: Story = {}
export const OnlyAdditions: Story = { args: { additions: 42, deletions: 0 } }
export const OnlyDeletions: Story = { args: { additions: 0, deletions: 8 } }
export const Unchanged: Story = { args: { additions: 0, deletions: 0 } }
export const CountsOnly: Story = { args: { showBar: false } }


export const GitCounts: Story = { args: { additions: 3, deletions: 0, showBar: false, hideZero: true, variant: 'git' } }
