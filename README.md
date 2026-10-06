# Lanka Alarm

Location alarm for Sri Lanka. Pick a station, bus stop or place; the phone rings when you get close. Position is read and compared on the device only.

## Run
Needs a dev build (background location and alarm audio do not work in Expo Go):

    npm install
    npx expo run:android     # or run:ios (needs Xcode)

## Layout
- `src/tracking.ts` background location task, decides when to ring
- `src/alarm.ts` siren loop, vibration, max-priority notification
- `src/places.ts` offline railway-station search (bundled OSM data), online town/place search (on Search key only), opt-in road route
- `src/LeafletMap.tsx` OpenStreetMap map in a WebView
- `src/data/stations.json` OSM extract, Sri Lanka only (360 stations, checked against the Sri Lanka Railways station list on 2026-10-06). No bus-stop data: bus stops are informal, so users search a town/junction or drop a named pin.

## Pending
- Bus filter and bus-route picker are on hold until routemaster.lk answers a data-permission request (sent 2026-10-06). Filters are All and Train only.

## Known gaps
- Full-screen alarm over the lock screen: `modules/full-screen-alarm` (Android only). Compiles, but not yet tested on a device.
- 18 stations on the official Sri Lanka Railways list have no coordinates here (not found in OpenStreetMap): Buthgamuwa, Udaththawala, Katunayaka Airport, Trade Zoone, Arachchikattuwa, Anawilundawa, Pulachchikulam, Mundal, Mangalaeliya, Thilladiya, Yahapauwa, Jaffna CSM, Jaffna SM (likely Jaffna itself), Piliduwa, Arukkuwatte, Uggalla, Murunkan, Talaimannar Pier. Add with verified coordinates.
- The data also has about 90 OpenStreetMap stations not on the official list (small halts, closed or newly mapped stops); kept because they are real mapped railway features.
- Public OSM tile, Nominatim and OSRM servers are for development; use a hosted provider before release.
- Not yet tested on a physical device.

## Data and credits
- Railway station positions and names: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Official station spellings were cross-checked against the Sri Lanka Railways station list (names only; no coordinates taken from it).
- Map tiles and place search: OpenStreetMap and Nominatim public servers (development use only).
- Not included: routemaster.lk data. Used only if its owners agree.
