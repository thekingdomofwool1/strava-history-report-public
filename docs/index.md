---
layout: default
---

<section class="hero">
  <h1>Learn about the landmarks along your favorite route</h1>
  <p class="subhead">and share with your followers</p>
  <p class="lead">
    We integrate with Strava to add an activity description that provides a link to a Wikipedia article about a location of interest or prominence along your route.
  </p>
  <p class="hero-cta-prompt">Connect with Strava to get started.</p>
  <p class="hero-cta"><a class="btn-strava" href="https://api.andvos.xyz/auth/strava/start">Connect with Strava</a></p>
  <p class="trust">Free &middot; Disconnect anytime, data deleted instantly &middot; Open source</p>
  <p class="status-connected" id="connected-msg">
    Strava account connected! New activities will be annotated automatically.
  </p>
</section>

<section class="preview">
  <p class="preview-caption">Your feed could look like this!</p>
  <img src="{{ '/assets/examples/feed-example-run.png' | relative_url }}" alt="Strava activity: chill run in Denver with a Wikipedia link about Iridescent Cloud sculpture in the description" loading="lazy" decoding="async" />
</section>

<section class="cards">
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
</section>

<section class="preview">
  <p class="preview-caption">Another example</p>
  <img src="{{ '/assets/examples/feed-example-afternoon.png' | relative_url }}" alt="Strava activity: afternoon run with a Wikipedia link about Boettcher Memorial Tropical Conservatory in the description" loading="lazy" decoding="async" />
</section>

<section class="faq">
  <h2>FAQ</h2>
  <h3>Does this spam my followers?</h3>
  <p>No. We only add one line to your own activity's description. Nothing is posted to anyone else's feed.</p>
  <h3>How often does it run?</h3>
  <p>Once per activity, automatically, right after it appears on Strava.</p>
  <h3>Is it really free?</h3>
  <p>Yes &mdash; a personal, open-source project. No accounts, no payment, no ads.</p>
</section>

<p class="site-version-row">
  <span>Version 1.2.0</span><span class="site-version-sep" aria-hidden="true">&middot;</span><a href="{{ '/changelog/' | relative_url }}">Changelog</a>
</p>

<script defer>
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
