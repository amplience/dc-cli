import { rewriteDeliveryContentItem } from './webhook-rewriter';

describe('webhook-rewriter tests', function() {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should not rewrite an empty string', async () => {
    expect(rewriteDeliveryContentItem('', 'account', 'staging')).toEqual('');
  });

  it('should not rewrite a simple string', async () => {
    expect(rewriteDeliveryContentItem('basic', 'account', 'staging')).toEqual('basic');
  });

  it('should not rewrite any unrelated tag', async () => {
    expect(rewriteDeliveryContentItem('{{#unrelated}}{{/unrelated}}', 'account', 'staging')).toEqual(
      '{{#unrelated}}{{/unrelated}}'
    );
  });

  it('should rewrite a simple webhook', async () => {
    const example = `{
{{#withDeliveryContentItem contentItemId=payload.id account="tobereplaced" stagingEnvironment="old"}}
  "content" : "{{~#each (first (pluck contentBlocks "content") 4)~}}{{~#each this.values~}}{{#if (eq locale "en-GB")}}{{{truncate value 1000}}}{{/if}}{{~/each~}}{{#unless @last}};{{/unless~}}{{~/each~}}"
{{/withDeliveryContentItem}}
}`;
    expect(rewriteDeliveryContentItem(example, 'account', 'staging')).toMatchSnapshot();
  });

  it('should rewrite multiple tags within the same webhook', async () => {
    const example = `{
{{#withDeliveryContentItem contentItemId=payload.id account="tobereplaced" stagingEnvironment="old"}}
  {{example1}}
{{/withDeliveryContentItem}}
  "key": "value",
{{#withDeliveryContentItem contentItemId=payload.id account="tobereplaced2" stagingEnvironment="old2"}}
  {{example1}}
{{/withDeliveryContentItem}}
}`;
    expect(rewriteDeliveryContentItem(example, 'account', 'staging')).toMatchSnapshot();
  });

  it('should rewrite only one argument if the other is not present', async () => {
    const example = `{
{{#withDeliveryContentItem contentItemId=payload.id account="tobereplacednostaging"}}
  {{example1}}
{{/withDeliveryContentItem}}
}`;
    expect(rewriteDeliveryContentItem(example, 'account', "doesn't appear")).toMatchSnapshot();
  });

  it('should not rewrite a tag with no matching arguments', async () => {
    const example = `{
{{#withDeliveryContentItem contentItemId=payload.id"}}
  {{example1}}
{{/withDeliveryContentItem}}
}`;
    expect(rewriteDeliveryContentItem(example, 'account', "doesn't appear")).toEqual(example);
  });

  it('should escape quotes and backslashes', async () => {
    const example = `{
{{#withDeliveryContentItem contentItemId=payload.id account="1" stagingEnvironment="2"}}
  {{example1}}
{{/withDeliveryContentItem}}
}`;
    expect(rewriteDeliveryContentItem(example, '"quotedString\\with\\backslash"', 'back\\slash')).toMatchSnapshot();
  });
  it('should still replace values with unusual whitespace', async () => {
    const example = `{
{{#withDeliveryContentItem 
    contentItemId=payload.id 
    account="1" 
    stagingEnvironment="another"\t    }}
  {{example1}}
{{/withDeliveryContentItem}}
}`;
    expect(rewriteDeliveryContentItem(example, 'replaced', 'whitespace')).toMatchSnapshot();
  });
});
