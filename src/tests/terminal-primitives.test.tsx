import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActiveConditions } from '../components/terminal/TerminalPrimitives'
import type { ActiveRule } from '../game/types'

const alternateSector: ActiveRule = { id: 'alternate-sector', activatedAt: 7, expiresAt: 13 }

describe('active condition display', () => {
  it('surfaces the exact required start sector for the current round', () => {
    expect(renderToStaticMarkup(<ActiveConditions rules={[alternateSector]} round={8} />)).toContain('BEGIN LEFT')
    expect(renderToStaticMarkup(<ActiveConditions rules={[alternateSector]} round={9} />)).toContain('BEGIN RIGHT')
  })
})
