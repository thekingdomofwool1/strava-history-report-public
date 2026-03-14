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
        <h1>Historical highlights for every activity</h1>
        <p className="lead">
          Every time you finish a Strava activity, we find a nearby landmark and automatically
          add a fun historical fact to your description.
        </p>
        <a className="button" href={connectUrl}>Connect with Strava</a>
        {connectedMsg && <p className="status">{connectedMsg}</p>}
      </section>

      <div className="cards-row">
        <section className="card">
          <h2>How it works</h2>
          <p>When you finish an activity, we find a nearby historical landmark and add a one-sentence fun fact to your description. You can edit or delete it any time.</p>
        </section>

        <section className="card">
          <h2>Privacy</h2>
          <p>
            We store only your Strava ID and OAuth tokens. Three GPS points from your route are
            sent to Google Maps to identify landmarks; your activity type (e.g. "Run") is sent
            to OpenAI to generate the note. No data is sold or shared. Disconnecting your Strava
            account deletes all stored data immediately.
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
