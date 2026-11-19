export interface Suggestion {
  label: string
  prompt: string
}

const DOWNLOAD_PROMPT =
  'Find a free dataset I can download, and prepare the download for me.'
const COMPUTE_PROMPT =
  'Help me run a Compute-to-Data job: suggest a dataset and a compatible algorithm, then prepare the job.'

/**
 * What to start with, for the page the user is on. They mix searching with
 * doing, because the examples are how users learn what the assistant can do.
 */
export function suggestionsFor(pathname: string, did?: string): Suggestion[] {
  const ask = (label: string, prompt = label): Suggestion => ({ label, prompt })
  if (pathname === '/asset/[did]' && did) {
    return [
      ask(
        'What is this asset and what does it cost?',
        `What is the asset ${did} and what does it cost?`
      ),
      ask(
        'Get this asset for me',
        `Prepare what I need to use the asset ${did}: a download if it can be downloaded, otherwise a Compute-to-Data job with a compatible algorithm or dataset.`
      ),
      ask(
        'What can I run with this asset?',
        `What can I run with the asset ${did}? Show what it is compatible with.`
      )
    ]
  }
  if (pathname === '/search') {
    return [
      ask('Find algorithms for satellite images'),
      ask('Download a free dataset', DOWNLOAD_PROMPT),
      ask('Run an algorithm without downloading the data', COMPUTE_PROMPT)
    ]
  }
  return [
    ask('Find datasets about soil or crops'),
    ask('Download a free dataset', DOWNLOAD_PROMPT),
    ask('Run an algorithm on a dataset', COMPUTE_PROMPT)
  ]
}

/** For a visitor without a session, whom the assistant can only help search. */
export function searchSuggestions(): Suggestion[] {
  return [
    {
      label: 'Find datasets about soil or crops',
      prompt: 'Find datasets about soil or crops'
    },
    {
      label: 'Free datasets I can download',
      prompt: 'Which datasets can I download for free?'
    },
    {
      label: 'Algorithms for satellite images',
      prompt: 'Find algorithms for satellite images'
    }
  ]
}
