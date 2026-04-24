---
layout: default
---

<style>
  .hero {
    margin-bottom: 2rem;
  }
  .hero h1 {
    margin: 0 0 0.35rem;
    line-height: 1.2;
  }
  .subhead {
    font-size: 0.95rem;
    color: #555;
    margin: 0 0 1.25rem;
    font-weight: 400;
  }
  .lead {
    font-size: 1rem;
    color: #333;
    margin: 0 0 1.25rem;
  }
  .btn-strava {
    display: inline-block;
    background: #fc4c02;
    color: #fff;
    padding: 0.7rem 1.5rem;
    border-radius: 999px;
    font-weight: 600;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .btn-strava:hover {
    background: #e04400;
    color: #fff;
  }
  .status-connected {
    display: none;
    margin-top: 0.75rem;
    color: #0f5132;
    background: #d1e7dd;
    padding: 0.6rem 0.9rem;
    border-radius: 8px;
    font-size: 0.875rem;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-top: 2rem;
  }
  .card h3 {
    margin-top: 0;
    font-size: 0.95rem;
  }
  .card p {
    font-size: 0.875rem;
    color: #444;
    margin: 0;
  }
  .card p + p {
    margin-top: 0.5rem;
  }
  .powered-by {
    font-size: 0.75rem;
    color: #aaa;
    margin-top: 0.75rem;
  }
  .site-version-row {
    font-size: 0.95rem;
    line-height: 1.45;
    color: #777;
    margin: 2.5rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }
  .site-version-row a {
    color: #0969da;
    font-weight: 500;
    text-decoration: none;
  }
  .site-version-row a:hover {
    text-decoration: underline;
    color: #0550ae;
  }
  .site-version-sep {
    margin: 0 0.35rem;
    color: #ccc;
  }
</style>

<div class="hero">
  <h1>Learn about the landmarks along your favorite route</h1>
  <p class="subhead">and share with your followers</p>
  <p class="lead">
    We integrate with Strava to add an activity description that provides a link to a Wikipedia article about a location of interest or prominence along your route.
  </p>
  <a class="btn-strava" href="https://api.andvos.xyz/auth/strava/start">Connect with Strava</a>
  <p class="status-connected" id="connected-msg">
    Strava account connected! New activities will be annotated automatically.
  </p>
</div>

<div class="cards">
  <div class="card">
    <h3>How it works</h3>
    <p>
      When you finish an activity we append a link to a Wikipedia article about a notable location along your route to your activity description.
    </p>
  </div>

  <div class="card">
    <h3>Privacy</h3>
    <p>
      We store only your Strava ID and OAuth tokens. Three GPS points from your route are
      sent to Wikipedia's public API to find nearby articles. No data is sold or shared.
      Disconnecting your Strava account deletes all stored data immediately.
    </p>
  </div>

  <div class="card">
    <h3>Contact</h3>
    <p>
      Questions or feedback?
      <a href="mailto:andrewgwoolman@gmail.com">andrewgwoolman@gmail.com</a>
    </p>
    <p class="powered-by">Powered by Strava</p>
  </div>
</div>

<p class="site-version-row">
  <span>Version 1.1.0</span><span class="site-version-sep" aria-hidden="true">·</span><a href="{{ '/changelog/' | relative_url }}">Changelog</a>
</p>

<script>
  (function () {
    var params = new URLSearchParams(window.location.search);
    var msg = document.getElementById('connected-msg');
    var LS_KEY = 'strava_athlete_id';

    if (params.get('connected')) {
      var athleteId = params.get('athlete');
      if (athleteId) localStorage.setItem(LS_KEY, athleteId);
      msg.style.display = 'block';
      history.replaceState(null, '', window.location.pathname);
      return;
    }

    var stored = localStorage.getItem(LS_KEY);
    if (stored) {
      fetch('https://api.andvos.xyz/auth/strava/status/' + stored)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.connected) {
            msg.style.display = 'block';
          } else {
            localStorage.removeItem(LS_KEY);
          }
        })
        .catch(function () {
          msg.style.display = 'block';
        });
    }
  })();
</script>
