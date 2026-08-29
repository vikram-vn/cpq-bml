import Switch from '../components/Switch';
import PropTypes from 'prop-types';

/**
 * Wrapper around Switch component for AI skill toggles.
 * Provides consistent PropTypes and forwards props.
 */
export default function AiSkillSwitch({ id, label, description, checked, disabled, onChange }) {
  return (
    <Switch
      id={id}
      label={label}
      description={description}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

AiSkillSwitch.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};
