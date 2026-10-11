import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as a11yAnnotations from '@storybook/addon-a11y/preview'
import preview from './preview'

const annotations = setProjectAnnotations([a11yAnnotations, preview])
beforeAll(annotations.beforeAll)
