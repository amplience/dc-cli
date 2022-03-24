/* eslint-disable @typescript-eslint/camelcase */

import { AugmentedDynamicContent } from '../augment/AugmentedDynamicContent';
import { ConfigurationParameters } from '../commands/configure';

const augmentedynamicContentClientFactory = (config: ConfigurationParameters): AugmentedDynamicContent =>
  new AugmentedDynamicContent(config);

export default augmentedynamicContentClientFactory;
