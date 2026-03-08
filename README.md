# Aster3D

Przegladarkowa gra inspirowana Asteroids, ale w 3D i z widokiem z kokpitu statku kosmicznego.

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

## Sterowanie

- `Klik` - aktywacja pointer lock
- `Mysz` - rozgladanie i celowanie
- `W / S` - ciag do przodu / hamowanie wsteczne
- `A / D` - yaw
- `Shift` - boost
- `Spacja` lub `LPM` - strzal
- `R` - restart po game over

## Zakres MVP

- widok z kokpitu
- lot arcade z bezwladnoscia
- losowo rozmieszczone asteroidy
- strzelanie i rozbijanie asteroid
- kolizje, tarcza, zycia, wynik i restart
