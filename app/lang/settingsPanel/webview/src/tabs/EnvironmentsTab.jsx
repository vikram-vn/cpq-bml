import { IconEnvironments } from '../components/Icons';
import Environments from '../components/Environments';

export default function EnvironmentsTab({ active, state, connection = {}, vscodeApi }) {
    if (!active) return null;
    const environments = state?.environments || [];

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconEnvironments />
                    Environment Profiles
                </h2>
                <p className="card-desc">Save site profiles to quickly activate and switch between credentials.</p>
                <Environments environments={environments} connection={connection} vscodeApi={vscodeApi} />
            </section>
        </div>
    );
}
