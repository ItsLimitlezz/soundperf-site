# SoundPerf, the site

Working name. Endorsed by FormFactor Performance.

The static site that serves the test signal for measuring a car or room sound system. Three pages,
no backend, no accounts, no build step. Deliberately dumb: it plays the signal and hands out the
files, and that is all it does.

Live at **https://itslimitlezz.github.io/soundperf-site/**

The measuring is done by a separate native iOS app, in a private repository. The two are independent.
This site works with no app installed, and the app works with no access to this site.

## Why this page does not measure anything

iOS applies automatic gain control to microphone input by default. That processing exists to flatten
level differences over time, which is precisely the quantity a measurement is trying to capture. A
browser cannot switch it off, and there is system level processing underneath regardless. A web based
measurement would produce a smooth, believable, substantially fictional curve, with no error anywhere
to catch it.

So this page plays the signal and stops there.

## Where the signal files are

Not in this repository. They are attached to the [`signals-v1`](../../releases/tag/signals-v1)
release, and every link on the site points there.

That is on purpose. The four WAV files come to 248 MB, which fits inside GitHub Pages' 1 GB limit but
would sit against its 100 GB monthly bandwidth allowance, and the Play page streams 60 MB every time
someone presses play. Release assets are served from a different CDN and do not count against that
allowance. Keeping them out of git also means re rendering the signal does not add another quarter of
a gigabyte to the history, permanently, every time.

The pages link to the release with absolute URLs written into the HTML, so downloads work with
JavaScript switched off entirely. `signals/manifest.json` is committed, because it is small and the
Play page reads the segment timeline from it.

## What is in the file

Five minutes and 28 seconds. Three seconds of silence, ten seconds of band limited pink noise to set
volume by, then five markers each followed by sixty seconds of pink noise, one per microphone
position. Everything sits 20 dB below full scale, because many head units apply soft limiting to USB
playback and a hot signal measures the limiter rather than the speakers.

The noise is synthesised in the frequency domain rather than by filtering white noise, so the slope
is exact rather than a filter approximation. Verified at 0.05 dB across 20 Hz to 20 kHz.

## Running it locally

```bash
python3 tools/serve.py --port 8765
```

Python's own `http.server` does not serve byte ranges, so an audio element cannot seek and a five
minute file has to be played from the top every time. `tools/serve.py` adds range support, which is
what every real static host already does.

## Deploying

GitHub Pages serves `main` from the repository root. Push and it is live. `.nojekyll` is present so
Pages copies the files through without running Jekyll over them.

## Replacing the signal

The files are produced by the `soundperf-signal` tool in the app repository, which shares its
generator with the app's own generator mode, so a phone playing the signal and a USB stick carrying
it are the same signal. To publish a new set, render them, verify them, then upload to a new release
tag and update the URLs in `download.html` and `play.html`.
