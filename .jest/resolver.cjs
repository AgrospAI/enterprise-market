module.exports = (request, options) => {
  try {
    return options.defaultResolver(request, options)
  } catch (error) {
    // Ocean's dependency graph includes packages with import-only exports.
    // Resolve those exports before SWC converts their source for Jest.
    if (
      error.code !== 'MODULE_NOT_FOUND' &&
      !error.message.startsWith('No known conditions')
    )
      throw error
    return options.defaultResolver(request, {
      ...options,
      conditions: [...(options.conditions || []), 'import']
    })
  }
}
