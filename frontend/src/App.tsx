import { useMemo } from 'react';

const getConnectedMessage = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('connected')
    ? 'Strava account connected! New activities will be annotated automatically.'
    : null;
};

const App = () => {
  const connectedMsg = useMemo(getConnectedMessage, []);
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? 'http://localhost:4000' : 'https://stravafacts.andvos.xyz');
  const connectUrl = `${apiBase}/auth/strava/start`;

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">Strava + History</p>
        <h1>Wikipedia highlights for every activity</h1>
        <p className="lead">
          Every time you finish a Strava activity, we find a nearby Wikipedia article along your route
          and add a short note with a link to your description.
        </p>
        <a className="button" href={connectUrl}>Connect with Strava</a>
        {connectedMsg && <p className="status">{connectedMsg}</p>}
      </section>

      <div className="cards-row">
        <section className="card">
          <h2>How it works</h2>
          <p>
            When you finish an activity, we sample points on your route, query Wikipedia for nearby
            articles, pick one using simple scoring, and append a fixed note with a link. You can
            edit or delete it any time.
          </p>
        </section>

        <section className="card">
          <h2>Privacy</h2>
          <p>
            We store only your Strava ID and OAuth tokens. Three GPS points from your route are
            sent to Wikipedia&apos;s public API (geosearch) to find articles; no Google or OpenAI
            keys are used. No data is sold or shared. Disconnecting your Strava account deletes
            all stored data immediately.
          </p>
        </section>

        <section className="card">
          <h2>Contact</h2>
          <p>
            Questions or feedback?{' '}
            <a href="mailto:andrewgwoolman@gmail.com">andrewgwoolman@gmail.com</a>
          </p>
          <p className="powered-by">Powered by Strava</p>
        </section>
      </div>
    </main>
  );
};

export default App;
