import React from 'react';
import { ChevronDown } from 'lucide-react';
import FortaleDropdown, { type FortaleDropdownOption } from './FortaleDropdown';
import { supportsNativeFloatIsland } from '../utils/nativeFloatIsland';

export default function LibraryTypeFilter<T extends string>({ label, value, options, onChange, width = 126 }: {
  label: string; value: T; options: FortaleDropdownOption<T>[]; onChange: (value: T) => void; width?: number;
}) {
  return <div className="relative h-9 shrink-0" style={{ width }}>
    {supportsNativeFloatIsland() ? <>
      {/* The system selection UI opens from a trigger that stays in the scroll content. */}
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value as T)}
        className="fortale-library-native-filter">
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white" />
    </> : <FortaleDropdown label={label} value={value} options={options} onChange={onChange}
      triggerClassName="fortale-library-filter-trigger" minMenuWidth={176} menuAlign="right" />}
  </div>;
}
