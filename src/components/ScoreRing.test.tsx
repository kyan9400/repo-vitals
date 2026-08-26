import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreRing } from './ScoreRing'

describe('ScoreRing', () => {
  it('exposes the numeric score and verdict to assistive technology', () => {
    render(<ScoreRing score={82} label="Strong foundation" />)

    expect(screen.getByRole('img', { name: '82 out of 100: Strong foundation' })).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
  })
})
