import type { Meta, StoryObj } from '@storybook/react-vite'
import { CodeBlock } from './index'
import { expect, userEvent, within, fn } from 'storybook/test'

const meta = { title: 'Brand/CodeBlock', component: CodeBlock, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { language: 'typescript', code: 'const workspace = await koda.workspaces.create({ name: \'Fix reconnect handling\' })\nconsole.log(workspace.id)', onCopy: fn() },  } satisfies Meta<typeof CodeBlock>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Wrapped: Story = { args: { wrap: true, code: 'pnpm --filter @koda/desktop test -- src/__tests__/components/WorkspaceSharing.test.tsx src/__tests__/components/QuestionRequests.test.tsx' } }
export const Copied: Story = { args: { copied: true } }
export const Copy: Story = { play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Copy code' })); await expect(args.onCopy).toHaveBeenCalledWith(args.code) } }
export const CopyUnavailable: Story = { args: { onCopy: undefined } }

