import testRender from '../../../../.jest/testRender'
import { render, screen } from '@testing-library/react'
import Pagination from './index'
import { MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS } from '@utils/aquarius'

describe('@shared/Pagination', () => {
  testRender(
    <Pagination
      totalPages={MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS + 1}
      currentPage={2}
      rowsPerPage={10}
      rowCount={30}
      onChangePage={() => jest.fn()}
    />
  )

  it('renders without currentPage prop', () => {
    render(
      <Pagination
        totalPages={10}
        rowsPerPage={10}
        rowCount={30}
        onChangePage={() => jest.fn()}
      />
    )
  })

  it('hides pagination when there is only one page', () => {
    render(
      <Pagination
        totalPages={1}
        currentPage={1}
        rowsPerPage={21}
        rowCount={15}
        onChangePage={() => jest.fn()}
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
