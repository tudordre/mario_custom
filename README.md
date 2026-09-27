# Mario Custom

Joc tip Mario făcut cu **Electron** + **HTML5 Canvas** (JavaScript ES modules).

## Ce face jocul

- Rulezi și sari ca un platformer clasic
- **Gropi**, **cărămizi** și **țevi** apar aleatoriu din față pe măsură ce înaintezi
- Trebuie să te cațări pe cărămizi și pe țevi ca să treci peste gropi
- Scorul crește cu distanța; recordul se salvează local

## Controale

| Tastă | Acțiune |
|--------|---------|
| ← → / A D | Mișcare |
| ↑ / W / Space | Săritură |
| R | Restart |
| Enter | Start / Din nou |

## Pornire

```bash
npm install
npm start
```

## Structură

```
electron/     – procesul principal Electron
src/
  index.html
  css/style.css
  js/         – motorul jocului (world, player, renderer, input)
```
