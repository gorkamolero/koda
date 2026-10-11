import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from './dialog'
import { Button } from './button'
import { Field, Input } from './input'
const meta = { title: 'Primitives/Dialog', component: DialogContent, subcomponents: { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter }, tags: ['autodocs'], args: { size: 'md' }, render: args => <Dialog><DialogTrigger asChild><Button variant="bracket">Share workspace</Button></DialogTrigger><DialogContent {...args}><DialogHeader><DialogTitle>Share workspace</DialogTitle><DialogDescription>Invite a collaborator to the design-system branch.</DialogDescription></DialogHeader><DialogBody><Field label="Invitation link" hint="Only people with this link can join."><Input readOnly value="koda://join/design-system-demo" /></Field></DialogBody><DialogFooter><DialogClose asChild><Button variant="bracket">Done</Button></DialogClose></DialogFooter></DialogContent></Dialog> } satisfies Meta<typeof DialogContent>
export default meta
type Story = StoryObj<typeof meta>
export const Medium: Story = {}
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }
export const OpenAndEscape: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); const trigger = canvas.getByRole('button', { name: 'Share workspace' }); await userEvent.click(trigger); const document = within(canvasElement.ownerDocument.body); await expect(document.getByRole('dialog')).toBeVisible(); await userEvent.keyboard('{Escape}'); await expect(document.queryByRole('dialog')).not.toBeInTheDocument(); await expect(trigger).toHaveFocus() } }
export const Open: Story = { play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Share workspace' })) } }
