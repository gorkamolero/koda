import type { Meta, StoryObj } from '@storybook/react-vite'
import { PatternExamples } from './workspace-demo'

const meta = { title: 'Patterns/Overview', component: PatternExamples, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof PatternExamples>
export default meta
type Story = StoryObj<typeof meta>
export const SharedSession: Story = {}
