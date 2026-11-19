import { i18n } from '../../../../i18n/index'
import * as Yup from 'yup'
import { getUserCustomParameterValidationSchema } from '../ConsumerParameters/_validation'
import { Option } from 'src/@types/ddo/Option'

export function getDownloadValidationSchema(
  parameters: Record<string, string | number | boolean | Option[]>[]
) {
  return Yup.object().shape({
    dataServiceParams: getUserCustomParameterValidationSchema(parameters),
    termsAndConditions: Yup.boolean()
      .required(i18n._('Required'))
      .isTrue(i18n._('Please agree to the Terms and Conditions.')),
    acceptPublishingLicense: Yup.boolean()
      .required(i18n._('Required'))
      .isTrue(i18n._('Please agree to the Publishing License.'))
  })
}
