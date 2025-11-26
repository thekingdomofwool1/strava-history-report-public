import { useMemo } from 'react';

const getStatusMessage = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected')) {
    return 'Strava account connected! Webhooks will now annotate new runs.';
  }
  return 'Connect your Strava account so we can annotate future runs.';
};

const steps = [
  'Connect and authorize via Strava’s official OAuth screen',
  'Approve the required scopes. You can revoke these whenever you want from the Strava settings page',
  'Immediately after authorization, my backend calls Stravas API (with your token) to register a webhook correlated to your account.',
  'After your activity is posted, that webhook notifies us, and we begin the backend steps (calling google maps API to identify locations & openAI API to create content)',
  'After the activity is posted my app will append a fun fact written by an llm (I know, sorry (GPT 4.0, see preceding step)) to your activities description. The fun fact will be related to a historical landmark (statue, museum, etc..) that is in close proximity to the route. If you did not pass by any significant landmarks the application will not leave a comment. However, if the entirety of the run took place within the confines of a park of significance (eg central park) then the fun fact will be a general overview of the park itself.'
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
