import { ComputeEnvironment } from '@oceanprotocol/lib'
import { buildResourceRequests } from './computeResources'
import { ResourceType } from 'src/@types/ResourceType'

jest.mock('@oceanprotocol/lib', () => ({}))

// Fixes the behaviour the compute wizard had before this function moved out of
// useComputeSubmission.
const environment = {
  id: 'env',
  resources: [
    { id: 'cpu', min: 1, max: 4 },
    { id: 'ram', min: 1, max: 8 },
    { id: 'disk', min: 0, max: 25 },
    { id: 'nvidia-gpu', type: 'gpu', min: 0, max: 1 },
    { id: 'cpu', min: 2, max: 2 }
  ],
  free: {
    resources: [
      { id: 'cpu', min: 1, max: 1 },
      { id: 'ram', min: 1, max: 1 },
      { id: 'disk', min: 0, max: 2 }
    ]
  }
} as unknown as ComputeEnvironment

const selected = (values: Partial<ResourceType>): ResourceType =>
  ({ jobDuration: 10, price: 0, mode: 'paid', ...values } as ResourceType)

describe('buildResourceRequests', () => {
  it('uses the free resources in free mode', () => {
    expect(
      buildResourceRequests(
        environment,
        selected({ mode: 'free', cpu: 1, ram: 1, disk: 0.1 })
      )
    ).toEqual([
      { id: 'cpu', amount: 1 },
      { id: 'ram', amount: 1 },
      { id: 'disk', amount: 0.1 }
    ])
  })

  it('uses the paid resources, gpu included, without duplicates', () => {
    expect(
      buildResourceRequests(
        environment,
        selected({ cpu: 3, ram: 4, disk: 5, gpu: 1 })
      )
    ).toEqual([
      { id: 'cpu', amount: 3 },
      { id: 'ram', amount: 4 },
      { id: 'disk', amount: 5 },
      { id: 'nvidia-gpu', amount: 1 }
    ])
  })

  it('falls back to the minimum when nothing is selected', () => {
    expect(
      buildResourceRequests(
        environment,
        selected({ mode: 'free' } as Partial<ResourceType>)
      )
    ).toEqual([
      { id: 'cpu', amount: 1 },
      { id: 'ram', amount: 1 },
      { id: 'disk', amount: 0 }
    ])
  })
})
