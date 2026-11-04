import { GroupBase, StylesConfig } from 'react-select'

// Shared spacing for the terms and ontology filter inputs: slightly more
// vertical than horizontal padding, and tight gaps between wrapped rows.
// Set via the styles prop because react-select does not label the value
// container, so it cannot be targeted from CSS modules.
export function selectSpacing<
  Option,
  IsMulti extends boolean = true
>(): StylesConfig<Option, IsMulti, GroupBase<Option>> {
  return {
    valueContainer: (base) => ({ ...base, padding: '6px' }),
    multiValue: (base) => ({ ...base, margin: '2px' }),
    input: (base) => ({
      ...base,
      margin: '2px',
      paddingTop: 0,
      paddingBottom: 0
    }),
    placeholder: (base) => ({ ...base, marginLeft: 2, marginRight: 2 })
  }
}
