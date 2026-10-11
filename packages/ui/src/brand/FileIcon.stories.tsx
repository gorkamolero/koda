import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileIcon } from './index'


const meta = { title: 'Brand/FileIcon', component: FileIcon, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { filename: 'App.tsx', type: 'file', size: 16 }, argTypes: { size: { options: [12, 14, 16], control: 'inline-radio' } },  } satisfies Meta<typeof FileIcon>
export default meta
type Story = StoryObj<typeof meta>
export const TypeScript: Story = { args: { filename: 'index.ts' } }
export const TypeScriptReact: Story = {}
export const JavaScript: Story = { args: { filename: 'index.js' } }
export const JavaScriptReact: Story = { args: { filename: 'App.jsx' } }
export const Css: Story = { args: { filename: 'styles.css' } }
export const Json: Story = { args: { filename: 'package.json' } }
export const Markdown: Story = { args: { filename: 'README.md' } }
export const Html: Story = { args: { filename: 'index.html' } }
export const Rust: Story = { args: { filename: 'main.rs' } }
export const Unknown: Story = { args: { filename: 'LICENSE' } }
export const FolderClosed: Story = { args: { filename: 'src', type: 'directory' } }
export const FolderExpanded: Story = { args: { filename: 'src', type: 'directory', isExpanded: true } }
export const Small: Story = { args: { size: 12 } }
export const Medium: Story = { args: { size: 14 } }
export const Large: Story = { args: { size: 16 } }

