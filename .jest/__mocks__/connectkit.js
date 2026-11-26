export function getDefaultClient() {
  return jest.fn()
}

export function useModal() {
  return { setOpen: jest.fn() }
}
