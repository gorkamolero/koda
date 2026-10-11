import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadingScreen } from './index'


const meta = { title: 'Brand/LoadingScreen', component: LoadingScreen, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { message: 'Connecting to the Koda workspace…' },  } satisfies Meta<typeof LoadingScreen>
export default meta
type Story = StoryObj<typeof meta>
export const Indeterminate: Story = {}
export const WithProgress: Story = { args: { progress: 64 } }
export const Complete: Story = { args: { progress: 100, message: 'Workspace ready' } }

