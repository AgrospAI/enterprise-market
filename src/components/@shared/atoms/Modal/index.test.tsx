import { fireEvent, render, screen } from '@testing-library/react'
import Modal from './'
import ReactModal from 'react-modal'

describe('Modal', () => {
  it('renders without crashing', () => {
    ReactModal.setAppElement(document.createElement('div'))

    const { rerender } = render(
      <Modal title="Hello" isOpen onToggleModal={() => null}>
        Hello
      </Modal>
    )
    expect(document.querySelector('.ReactModalPortal')).toBeInTheDocument()

    rerender(
      <Modal title="Hello" isOpen={false} onToggleModal={() => null}>
        Hello
      </Modal>
    )
  })
})

it('locks page scrolling while open and supports Escape by default', () => {
  const onClose = jest.fn()
  const { rerender } = render(
    <Modal title="Scrollable dialog" isOpen onToggleModal={onClose}>
      Content
    </Modal>
  )
  expect(document.body).toHaveClass('ReactModal__Body--open')
  expect(document.documentElement).toHaveClass('ReactModal__Html--open')
  fireEvent.keyDown(screen.getByRole('dialog'), {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27
  })
  expect(onClose).toHaveBeenCalledTimes(1)
  rerender(
    <Modal title="Scrollable dialog" isOpen={false} onToggleModal={onClose}>
      Content
    </Modal>
  )
  expect(document.body).not.toHaveClass('ReactModal__Body--open')
  expect(document.documentElement).not.toHaveClass('ReactModal__Html--open')
})
