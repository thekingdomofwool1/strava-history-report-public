---
layout: default
title: Changelog
permalink: /changelog/
---

<style>
  .changelog-intro {
    font-size: 0.95rem;
    color: #555;
    margin: 0 0 1.75rem;
    max-width: 40rem;
  }
  .changelog-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-width: 40rem;
  }
  .changelog-list li {
    margin: 0 0 1.35rem;
    padding-bottom: 1.35rem;
    border-bottom: 1px solid #eee;
  }
  .changelog-list li:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .changelog-meta {
    font-size: 0.8rem;
    color: #888;
    margin: 0 0 0.35rem;
    letter-spacing: 0.02em;
  }
  .changelog-list h2 {
    font-size: 1.05rem;
    margin: 0 0 0.4rem;
    font-weight: 600;
  }
  .changelog-list p {
    font-size: 0.9rem;
    color: #444;
    margin: 0;
    line-height: 1.45;
  }
  .changelog-back {
    font-size: 0.875rem;
    margin-top: 2rem;
  }
</style>

<p class="changelog-intro">
  Notable releases for this project. Patch bumps may list only a short summary when changes are routine.
</p>

<ul class="changelog-list">
  <li>
    <p class="changelog-meta">24 April 2026 · <strong>1.1.0</strong></p>
    <h2>UI overhaul</h2>
    <p>
      UI overhaul, switched frontend hosting to github pages as opposed to the monolith architecture I had previously.
    </p>
    <p>
      Also in this release: a Jekyll + GitHub Pages marketing site (replacing the old combined UI), refreshed hero copy, a public changelog linked from the footer with semver, and two real Strava activity screenshots in the sidebar so visitors can see how Wikipedia links show up on a feed. Ongoing layout work moves maintainer and repository links below those previews and keeps the theme credits under the main column so nothing covers the examples—on the home page and on the changelog.
    </p>
  </li>
  <li>
    <p class="changelog-meta">26 March 2026 · <strong>1.0.0</strong></p>
    <h2>New Wikipedia integration</h2>
    <p>
      Simplified the application logic: removed AI-generated content and now rely on the Wikipedia geosearch API to identify relevant articles, matched against location data shared from Strava.
    </p>
  </li>
  <li>
    <p class="changelog-meta">19 March 2026 · <strong>0.2.1</strong></p>
    <h2>Maintenance</h2>
    <p>Minor improvements and fixes.</p>
  </li>
  <li>
    <p class="changelog-meta">5 March 2026 · <strong>0.2.0</strong></p>
    <h2>Strava developer program</h2>
    <p>
      After several bugfixes, the application was accepted into the Strava developer ecosystem, allowing more athletes to connect.
    </p>
  </li>
  <li>
    <p class="changelog-meta">27 February 2026 · <strong>0.1.1</strong></p>
    <h2>Maintenance</h2>
    <p>Minor improvements and fixes.</p>
  </li>
  <li>
    <p class="changelog-meta">19 February 2026 · <strong>0.1.0</strong></p>
    <h2>First public iteration</h2>
    <p>
      Developed the first iteration: used the Google Maps API to identify locations along activities and generated short fun facts via ChatGPT.
    </p>
  </li>
</ul>

<p class="changelog-back"><a href="{{ '/' | relative_url }}">← Back to home</a></p>
