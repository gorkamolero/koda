import type { Meta, StoryObj } from '@storybook/react-vite'
import { InlineCode } from './index'


const meta = { title: 'Brand/InlineCode', component: InlineCode, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { children: 'pnpm --filter @koda/ui storybook' },  } satisfies Meta<typeof InlineCode>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
