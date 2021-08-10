function matchAll(regex: RegExp, string: string): RegExpExecArray[] {
  const result: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(string)) != null) {
    result.push(match);
  }

  return result;
}

export function rewriteDeliveryContentItem(
  webhookBody: string,
  account: string,
  stagingEnvironment: string | undefined
): string {
  // Current limitations - cannot handle key/value pairs where the value contains space, or a }} within quotes.
  // These should not affect the two variables being replaced anyways.
  // First, locate the withDeliveryContentItem opening tags.

  const tagRegexG = /\{\{\#withDeliveryContentItem(?<whitespace>\s+)(?<body>.+\=.+(\s+.+\=.+)*\s*)\}\}/g;
  const keyValueRegex = /(?<key>.+?)\=(?<value>.+?)\s+/g;

  const tagMatches = matchAll(tagRegexG, webhookBody);

  let replaceOffset = 0;

  for (const tag of tagMatches) {
    const tGroups = tag.groups as { [key: string]: string };

    const matchIndex = tag.index;
    const body = tGroups.body + ' ';
    const bodyIndex = matchIndex + '{{#withDeliveryContentItem'.length + tGroups.whitespace.length;

    const keyValueMatches = matchAll(keyValueRegex, body);

    for (const pair of keyValueMatches) {
      const pGroups = pair.groups as { [key: string]: string };

      const key = pGroups.key;
      const keyIndex = bodyIndex + pair.index + replaceOffset;

      const value = pGroups.value;
      const valueIndex = keyIndex + key.length + 1;

      let replaceValue: string | null = null;

      switch (key) {
        case 'account':
          replaceValue = account;
          break;
        case 'stagingEnvironment':
          if (stagingEnvironment !== undefined) {
            replaceValue = stagingEnvironment;
          }
          break;
      }

      if (replaceValue != null) {
        replaceValue = `"${replaceValue.replace(/\\/g, '\\\\').replace(/"/g, '"')}"`;
        webhookBody = webhookBody.substr(0, valueIndex) + replaceValue + webhookBody.substr(valueIndex + value.length);

        replaceOffset += replaceValue.length - value.length;
      }
    }
  }

  return webhookBody;
}
