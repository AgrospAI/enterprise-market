import { mergeConsumerParameters } from './consumerParameters'

describe('mergeConsumerParameters', () => {
  it('combines algorithm metadata and service parameters', () => {
    expect(
      mergeConsumerParameters(
        [{ name: 'title' }, { name: 'sensitive' }],
        [{ name: 'serviceOnly' }]
      )
    ).toEqual([
      { name: 'title' },
      { name: 'sensitive' },
      { name: 'serviceOnly' }
    ])
  })

  it('does not repeat parameters with the same name', () => {
    expect(
      mergeConsumerParameters(
        [{ name: 'title', default: 'from metadata' }],
        [{ name: 'title', default: 'from service' }]
      )
    ).toEqual([{ name: 'title', default: 'from metadata' }])
  })

  it('ignores missing groups', () => {
    expect(mergeConsumerParameters(undefined, null, [])).toEqual([])
  })
})
