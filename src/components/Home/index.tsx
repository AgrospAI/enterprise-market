import {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactElement,
  CSSProperties,
  useRef
} from 'react'
import type { MouseEvent } from 'react'
import styles from './index.module.css'
import InputElement from '@shared/FormInput/InputElement'

import Features from './Features/Features'
import EcosystemStats from './Sections/EcosystemStats'
import Products from './Sections/Products'
import Upload from '@images/publish.svg'
import SearchLogo from '@images/search.svg'
import { addExistingParamsToUrl } from '../Search/utils'
import { useRouter } from 'next/router'
import { useSearchBarStatus } from '@context/SearchBarStatus'
import content from '../../../content/pages/home/content.json'

async function emptySearch() {
  const searchParams = new URLSearchParams(window?.location.href)
  const text = searchParams.get('text')

  if (text !== '' && text !== undefined && text !== null) {
    await addExistingParamsToUrl(location, ['text', 'owner', 'tags'])
  }
}

// filled wave twice the viewBox width with a 720-unit period, so a
// 1440-unit shift loops seamlessly
function heroWaveLayer(y: number, amplitude: number): string {
  let d = `M0 ${y} Q180 ${y - amplitude} 360 ${y}`
  for (let x = 720; x <= 2880; x += 360) d += ` T${x} ${y}`
  return `${d} L2880 141 L0 141 Z`
}

// back to front: every layer sits lower and is brighter than the one behind
const heroWaveLayers = [
  { y: 44, amplitude: 30 },
  { y: 62, amplitude: 26 },
  { y: 82, amplitude: 22 }
]

const heroWaveGradients = [
  ['stopNavy', 'stopBlue'],
  ['stopBlue', 'stopHighlight'],
  ['stopHighlight', 'stopCyan'],
  ['stopMist', 'stopWhite']
]

function HeroSection({
  placeholder,
  initialValue
}: {
  placeholder?: string
  initialValue?: string
}): ReactElement {
  const router = useRouter()
  const [value, setValue] = useState(initialValue || '')
  const parsed = router.query
  const searchBarRef = useRef<HTMLInputElement>(null)
  const {
    isSearchBarVisible,
    setSearchBarVisible,
    homeSearchBarFocus,
    setHomeSearchBarFocus
  } = useSearchBarStatus()

  useEffect(() => {
    if (parsed?.text || parsed?.owner)
      setValue((parsed?.text || parsed?.owner) as string)
  }, [parsed?.text, parsed?.owner])

  useEffect(() => {
    setSearchBarVisible(false)
    setHomeSearchBarFocus(false)
  }, [setSearchBarVisible, setHomeSearchBarFocus])

  useEffect(() => {
    if (!isSearchBarVisible && !homeSearchBarFocus) return
    if (searchBarRef?.current) {
      searchBarRef.current.focus()
    }
  }, [isSearchBarVisible, homeSearchBarFocus])

  async function startSearch() {
    if (value === '') setValue(' ')

    const urlEncodedValue = encodeURIComponent(value)
    const url = await addExistingParamsToUrl(location, [
      'text',
      'owner',
      'tags'
    ])
    router.push(`${url}&text=${urlEncodedValue}`)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    e.target.value === '' && emptySearch()
  }

  async function handleKeyPress(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      await startSearch()
    }
  }

  async function handleButtonClick(e: FormEvent<HTMLButtonElement>) {
    e.preventDefault()
    await startSearch()
  }
  const handlePublishClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    router.push('/publish/1')
  }
  const handleCatalogClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    router.push('/search?sort=indexedMetadata.event.block&sortOrder=desc')
  }

  return (
    <section className={styles.hero}>
      <div className={styles.contentContainer}>
        <div className={styles.textContent}>
          <h1 className={styles.title}>{content.hero.title}</h1>
          <p className={styles.subtitle}>{content.hero.subtitle}</p>

          <form
            className={styles.searchBlock}
            autoComplete={!value ? 'off' : 'on'}
            role="search"
          >
            <div className={styles.searchContainer}>
              <InputElement
                ref={searchBarRef}
                type="search"
                name="search"
                aria-label="Search for data"
                placeholder={placeholder || content.hero.searchPlaceholder}
                value={value}
                onChange={handleChange}
                required
                size="large"
                className={styles.searchInput}
                onKeyPress={handleKeyPress}
              />
              <button
                onClick={handleButtonClick}
                className={styles.searchButton}
              >
                <SearchLogo className={styles.searchIcon} />
                <span>Search</span>
              </button>
            </div>
          </form>

          <div className={styles.ctaRow}>
            <button className={styles.ctaGhost} onClick={handlePublishClick}>
              <Upload className={styles.uploadIcon} />
              Publish an asset
            </button>
            <button className={styles.ctaPrimary} onClick={handleCatalogClick}>
              Browse the catalogue
              <span className={styles.ctaArrow} aria-hidden="true">
                →
              </span>
            </button>
          </div>
        </div>
      </div>

      <EcosystemStats />

      {/* wave transition into the light section below */}
      <svg
        className={styles.heroWave}
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {heroWaveGradients.map((stops, index) => (
            <linearGradient
              key={index}
              id={`hero-wave-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0" className={styles[stops[0]]} />
              <stop offset="1" className={styles[stops[1]]} />
            </linearGradient>
          ))}
        </defs>
        {heroWaveLayers.map((layer, index) => (
          <path
            key={index}
            className={styles.heroWaveLayer}
            d={heroWaveLayer(layer.y, layer.amplitude)}
            fill={`url(#hero-wave-${index})`}
            style={{ '--i': index } as CSSProperties}
          />
        ))}
        <path
          d="M0 108 C240 78 480 134 720 110 C960 86 1200 128 1440 100 L1440 141 L0 141 Z"
          fill={`url(#hero-wave-${heroWaveLayers.length})`}
        />
      </svg>
    </section>
  )
}

export default function HomePage(): ReactElement {
  return (
    <>
      <HeroSection />
      <Features />
      <Products />
    </>
  )
}
