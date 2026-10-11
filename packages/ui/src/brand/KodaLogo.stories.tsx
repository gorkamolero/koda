import type { Meta, StoryObj } from '@storybook/react-vite'
import { KodaLogo } from './index'


const meta = { title: 'Brand/KodaLogo', component: KodaLogo, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { size: 'lg', animated: false }, argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },  } satisfies Meta<typeof KodaLogo>
export default meta
type Story = StoryObj<typeof meta>
export const Small: Story = { args: { size: 'sm' } }
export const Medium: Story = { args: { size: 'md' } }
export const Large: Story = { args: { size: 'lg' } }
export const Animated: Story = { args: { animated: true } }

