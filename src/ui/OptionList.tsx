import { useId } from 'react';

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface OptionListProps<T extends string> {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Escolha única em lista, com descrição opcional em cada opção. */
export function OptionList<T extends string>({
  legend,
  options,
  value,
  onChange,
}: OptionListProps<T>) {
  const name = useId();
  return (
    <fieldset className="options">
      <legend className="options__legend">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="option">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => {
              onChange(option.value);
            }}
          />
          <span className="option__body">
            <span className="option__label">{option.label}</span>
            {option.description && (
              <span className="option__description">{option.description}</span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
