export type HtmlType = 'Text' | 'Radio' | 'Select' | 'CheckBox';

export interface APIOptionValue {
  id: number;
  name: string;
  label: string;
  value: any;
}

export interface APICustomField {
  id: number;
  label: string;
  name: string;
  html_type: HtmlType;
  is_required: boolean;
  option_group_id: number | null;
  'option_group_id:name': string | null;
  'custom_group_id:name': string;
  options: APIOptionValue[];
}