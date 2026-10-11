import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from './button'
const meta = { title: 'Primitives/Button', component: Button, tags: ['autodocs'], args: { children: 'Share workspace', onClick: fn() }, argTypes: { variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'outline', 'destructive', 'link', 'bracket'] }, size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] } } } satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete session' } }
export const Link: Story = { args: { variant: 'link', children: 'View changes' } }
export const Bracket: Story = { args: { variant: 'bracket', children: 'SHARE' } }
export const Sizes: Story = { render: () => <div className="flex items-center gap-4"><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button><Button size="icon" aria-label="Add workspace">+</Button></div> }
export const Disabled: Story = { args: { disabled: true } }
export const Loading: Story = { args: { loading: true, children: 'Sharing…' } }
export const AsChild: Story = { render: () => <Button asChild variant="bracket"><a href="#workspace">Open workspace</a></Button> }
export const Hover: Story = { play: async ({ canvasElement }) => { await userEvent.hover(within(canvasElement).getByRole('button')) } }
export const Focus: Story = { play: async ({ canvasElement }) => { const button = within(canvasElement).getByRole('button'); await userEvent.tab(); await expect(button).toHaveFocus(); await expect(button.matches(':focus-visible')).toBe(true) } }
export const Active: Story = { play: async ({ canvasElement }) => { await userEvent.pointer({ target: within(canvasElement).getByRole('button'), keys: '[MouseLeft>]' }) } }
export const KeyboardActivation: Story = { play: async ({ canvasElement, args }) => { const button = within(canvasElement).getByRole('button'); button.focus(); await userEvent.keyboard('{Enter}'); await expect(args.onClick).toHaveBeenCalledOnce() } }

export const DisabledChild: Story = { args: { disabled: true }, render: args => <Button asChild disabled={args.disabled}><a href="#workspace" onClick={args.onClick}>Open workspace</a></Button>, play: async ({ canvasElement, args }) => { const anchor = within(canvasElement).getByRole('link'); anchor.focus(); await userEvent.keyboard('{Enter}'); await expect(args.onClick).not.toHaveBeenCalled(); await expect(anchor).toHaveAttribute('tabindex', '-1') } }
export const LoadingChild: Story = { ...DisabledChild, args: { loading: true }, render: args => <Button asChild loading={args.loading}><a href="#workspace" onClick={args.onClick}>Opening workspace</a></Button> }

export const SecondaryHover: Story = { args: { variant: 'secondary' }, play: async ({ canvasElement }) => { await userEvent.hover(within(canvasElement).getByRole('button')) } }
