import { useMemo } from 'react';

const getStatusMessage = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected')) {
    return 'Strava account connected! Webhooks will now annotate new runs.';
  }
  return 'Connect your Strava account so we can annotate future runs.';
};

const steps = [
  'We interact with the Strava API using read access plus the ability to write activity descriptions. Permissions are revocable at any time, and any activity description we add can be edited or deleted by you.',
  'Ever wondered what that cool statue along your route represents? Ever wanted to share those insights with your followers? Now you can! This app will add a fun fact related to a landmark along your route to your activity description. Relevant historical landmarks are identified via the Google Maps API and fun facts are generated with ChatGPT 4.0.'
];

const App = () => {
  const status = useMemo(getStatusMessage, []);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
  const connectUrl = `${apiBase}/auth/strava/start`;

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">Strava + History</p>
        <h1>Historical highlights for every run</h1>
        <p className="lead">
          We watch for completed Strava runs, find historical landmarks along your route, ask an LLM for a
          single-sentence note, and post it back to your activity description.
        </p>
        <a className="button" href={connectUrl}>
          Connect Strava
        </a>
        <p className="status">{status}</p>
      </section>
      <section className="card">
        <h2>How it works</h2>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
};

export default App;
