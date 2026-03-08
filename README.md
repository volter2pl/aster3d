# Aster3D

Przegladarkowa gra inspirowana Asteroids, ale w 3D i z widokiem z kokpitu statku kosmicznego.

Zagraj online:
https://volter2pl.github.io/aster3d/

## Stack

- `Babylon.js`
- `TypeScript`
- `Vite`

## Uruchomienie

```bash
npm install
npm run dev
```

Build produkcyjny:

```bash
npm run build
```

## GitHub Pages

Repo ma workflow GitHub Actions w `/.github/workflows/deploy-pages.yml`.

Aby publikacja zadzialala:

```text
GitHub -> Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

Kazdy push na `main`:
- instaluje zaleznosci
- buduje projekt
- publikuje zawartosc `dist` na GitHub Pages

## Sterowanie

- `Klik` - aktywacja pointer lock
- `Mysz` - rozgladanie i celowanie
- `Strzalki` - pitch / yaw
- `W / S` - ciag do przodu / hamowanie wsteczne
- `A / D` - yaw
- `Shift` - boost
- `Spacja` - strzal
- `R` - restart po game over

## Zakres MVP

- widok z kokpitu
- lot arcade z bezwladnoscia
- losowo rozmieszczone asteroidy
- strzelanie i rozbijanie asteroid
- kolizje, tarcza, zycia, wynik i restart
