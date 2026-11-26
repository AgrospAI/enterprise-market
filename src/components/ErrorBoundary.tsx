import posthog from 'posthog-js'
import { Component, ErrorInfo, ReactNode } from 'react'
import { i18n } from '../i18n'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    posthog.captureException(error, {
      component_stack: errorInfo.componentStack
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <h1>{i18n._('Something went wrong.')}</h1>
    }

    return this.props.children
  }
}
