import { i18n } from '../../../../../i18n/index'
import { FormConsumerParameter } from '@components/Publish/_types'
import * as Yup from 'yup'
import { SchemaLike } from 'yup/lib/types'
import { paramTypes } from '.'

export const validationConsumerParameters: {
  [key in keyof FormConsumerParameter]: SchemaLike
} = {
  name: Yup.string()
    // .test('unique', 'Parameter names must be unique', (name, context) => {
    //   const [parentFormObj, nextParentFormObj] = (
    //     context as TestContextExtended
    //   ).from

    //   if (
    //     !nextParentFormObj?.value?.consumerParameters ||
    //     nextParentFormObj.value.consumerParameters.length === 1
    //   )
    //     return true

    //   const { consumerParameters } = nextParentFormObj.value
    //   const occasions = consumerParameters.filter(
    //     (params) => params.name === name
    //   )
    //   return occasions.length === 1
    // })
    .max(50, (param) =>
      i18n._('Name must have maximum {value0} characters', {
        value0: param.max
      })
    )
    .required(() => i18n._('Required')),
  type: Yup.string()
    .oneOf(paramTypes)
    .required(() => i18n._('Required')),
  description: Yup.string()
    .min(10, (param) =>
      i18n._('Description must be at least {value0} characters', {
        value0: param.min
      })
    )
    .max(500, (param) =>
      i18n._('Description must have maximum {value0} characters', {
        value0: param.max
      })
    )
    .required(() => i18n._('Required')),
  label: Yup.string()
    .max(50, (param) =>
      i18n._('Label must have maximum {value0} characters', {
        value0: param.max
      })
    )
    .required(() => i18n._('Required')),
  required: Yup.string()
    .oneOf(['optional', 'required'])
    .required(() => i18n._('Required')),
  default: Yup.mixed().required(() => i18n._('Required')),
  options: Yup.array().when('type', {
    is: 'select',
    then: Yup.array()
      .of(Yup.object())
      .min(2, () => i18n._('At least two options are required'))
      .required(() => i18n._('Required')),
    otherwise: Yup.array()
  })
}
