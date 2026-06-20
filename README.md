# Minfinite Timeline

A free, zero-login, client-side timeline tool. Add events manually or import a CSV, then zoom and pan through history. No data is stored.

## Features

- Add events with name, year, optional month/day, and BC/AD era
- Import events from a CSV file (download a template from within the app)
- Visual timeline with automatic density handling — events cluster at low zoom and expand as you zoom in
- Zoom, pan, and drag-to-select a range directly on the timeline
- Export your event list as CSV
- Export the timeline view as a PNG image

## Usage

Open `index.html` in any modern browser — no server or install required.

Or visit the live version at [timeline.manupanizo.com](https://timeline.manupanizo.com).

## CSV format

```
name,year,month,day,is_bc
"Moon Landing",1969,7,20,false
"Battle of Hastings",1066,10,,false
"Julius Caesar born",100,,,true
```

`month`, `day`, and `is_bc` are optional. A template is available inside the app via **Import CSV → Download template**.

## License

See [LICENSE.md](LICENSE.md).
