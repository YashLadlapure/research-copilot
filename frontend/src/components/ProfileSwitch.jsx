import { PROFILES } from '../profiles';

// Radio buttons drawn as a segmented control, so arrow keys and screen
// readers treat it as the single choice it is.
export default function ProfileSwitch({ value, onChange, disabled }) {
  return (
    <fieldset className="switch" disabled={disabled}>
      <legend className="visually-hidden">Target format</legend>
      {PROFILES.map((option) => (
        <label key={option.value} className="switch__option">
          <input
            type="radio"
            name="profile"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
