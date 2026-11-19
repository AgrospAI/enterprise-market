import { useLingui } from '@lingui/react'
import {
  CSSProperties,
  KeyboardEvent,
  ReactElement,
  useRef,
  useState
} from 'react'
import { contentPagesHomeContent as content } from '../../../i18n/content'
import shared from '../Sections/shared.module.css'
import SectionHeader from '../Sections/SectionHeader'
import { useReveal } from '../Sections/useReveal'
import styles from './features.module.css'
import AgentScene from './scenes/AgentScene'
import IdentityScene from './scenes/IdentityScene'
import SovereigntyScene from './scenes/SovereigntyScene'

// one animated illustration per feature
const scenes: Record<string, () => ReactElement> = {
  agents: AgentScene,
  identity: IdentityScene,
  sovereignty: SovereigntyScene
}

const panelId = 'home-features-panel'
const tabId = (index: number): string => `home-features-tab-${index}`
const pad = (value: number): string => String(value).padStart(2, '0')

export default function Features(): ReactElement {
  useLingui()

  const { title, titleMuted, items } = content.features
  const [ref, reveal] = useReveal<HTMLElement>(0.15)
  const [active, setActive] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const current = items[active]
  const Scene = scenes[current.scene]

  // any user choice stops the rotation for good (WCAG 2.2.2)
  function select(index: number) {
    setActive(index)
    setAutoplay(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = items.length - 1
    let target: number

    switch (event.key) {
      case 'ArrowLeft':
        target = active === 0 ? last : active - 1
        break
      case 'ArrowRight':
        target = active === last ? 0 : active + 1
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = last
        break
      default:
        return
    }

    event.preventDefault()
    select(target)
    tabRefs.current[target]?.focus()
  }

  return (
    <section
      ref={ref}
      data-reveal={reveal}
      className={styles.featuresSection}
      aria-labelledby="home-features-title"
    >
      <div className={shared.container}>
        <SectionHeader
          id="home-features-title"
          title={title}
          titleMuted={titleMuted}
        />

        <div className={styles.explorer} data-autoplay={autoplay}>
          <div
            className={`${styles.tabList} ${shared.reveal}`}
            style={{ '--i': 1 } as CSSProperties}
            role="tablist"
            aria-label={`${title} ${titleMuted}`}
            aria-orientation="horizontal"
          >
            {items.map((feature, index) => (
              <button
                key={feature.title}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                type="button"
                role="tab"
                id={tabId(index)}
                className={styles.tab}
                aria-selected={index === active}
                aria-controls={panelId}
                tabIndex={index === active ? 0 : -1}
                onClick={() => select(index)}
                onKeyDown={handleKeyDown}
              >
                <span className={styles.tabNumber} aria-hidden="true">
                  {pad(index + 1)}
                </span>
                <span className={styles.tabTitle}>{feature.title}</span>
                <span className={styles.progress} aria-hidden="true">
                  {/* the bar's animation end drives the rotation, so pausing it pauses autoplay */}
                  <span
                    className={styles.progressBar}
                    onAnimationEnd={() => {
                      if (index === active)
                        setActive((index + 1) % items.length)
                    }}
                  />
                </span>
              </button>
            ))}
          </div>

          <div
            className={`${styles.panel} ${shared.reveal}`}
            style={{ '--i': 2 } as CSSProperties}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(active)}
            tabIndex={0}
          >
            <span className={styles.counter} aria-hidden="true">
              {pad(active + 1)} / {pad(items.length)}
            </span>

            <div key={active} className={styles.copy}>
              <h3 className={styles.panelTitle}>{current.title}</h3>
              <p className={styles.panelText}>{current.text}</p>
              <ul className={styles.points}>
                {current.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>

            {/* keyed so the scene restarts from its first frame on every switch */}
            <div className={styles.scene}>
              <Scene key={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
