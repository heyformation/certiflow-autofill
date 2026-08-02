export type TargetType = 'table_cell' | 'checkbox' | 'signature';

export interface TableCellTarget {
  type: 'table_cell';
  table_index: number;
  row_index: number;
  column_index: number;
  label?: string;
}

export interface CheckboxTarget {
  type: 'checkbox';
  table_index: number;
  row_index: number;
  column_index: number;
  label?: string;
  options: string[];
  labels: Record<string, string>;
}

export interface SignatureTarget {
  type: 'signature';
  table_index: number;
  row_index: number;
  column_index: number;
  max_width_cm?: number;
  max_height_cm?: number;
}

export type FieldTarget = TableCellTarget | CheckboxTarget | SignatureTarget;

export interface FieldMapping {
  field_key: string;
  source_path: string;
  target: FieldTarget;
}
