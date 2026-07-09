export default function Switch({ id, label, description, checked, onChange }) {
    return (
        <div className="switch">
            <div className="switch-label-group">
                <span className="switch-label">{label}</span>
                {description && <p className="field-hint">{description}</p>}
            </div>
            <label className="switch-control" htmlFor={id}>
                <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
                <span className="switch-track">
                    <span className="switch-thumb" />
                </span>
            </label>
        </div>
    );
}
