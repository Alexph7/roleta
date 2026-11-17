# roleta (Mini App do Telegram)

Mini App do Telegram em Node.js/Express com SQLite. Abre dentro do Telegram e tem dois modos: **Modo Sorte** (roletas e prêmios) e **Modo Habilidade** (jogos).

Partes marcadas com "(confirmar)" foram deduzidas pelos nomes dos arquivos.

## Modo Sorte

- Roleta Premiada e Roleta de Pontos.
- Ranking, Baú da Segunda Chance e 100x100.
- Rankings extras: diamantes, baús e média ativa.
- News (avisos na tela) (confirmar).
- Perfil do jogador.
- Captcha de pontos (anti-robô para ganhar pontos), ligado pelo `CAPTCHA_PONTOS_ATIVO`.

## Modo Habilidade

| Jogo | Front (public) | Servidor | Observação |
|---|---|---|---|
| Jogo da Memória | memoria.js, memoria.css | routes/memoria.js, services/jogo-memoria.js | grade 6x6, 18 pares, jogo livre com música |
| Tetris (antes "Blocos") | tetris.js, tetris-motor.js, tetris.css | routes/tetris.js, services/jogo-tetris.js | 14 colunas, ranking e campeonato |
| Sudoku | sudoku.js, sudoku.css | (só no navegador) (confirmar) | 2 dicas por partida, música |
| Território (estilo Paper.io) | territorio.js, territorio.css | (confirmar) | liberado só para o ADMIN_ID enquanto está em teste |

A tela de escolha dos jogos fica em `habilidade.js`.

## Segurança

- `contentSecurityPolicy` só deixa a página abrir dentro do Telegram (web.telegram.org e *.telegram.org).
- Limite de 100 pedidos por minuto por pessoa (`rateLimit`).
- Corpo das requisições limitado a 30 KB.

## Estrutura

- `index.js`: servidor (Express), rotas e segurança.
- `database.js`: banco principal (`roleta.db`).
- `routes/`: rotas da API (100x100, memoria, news, perfil, rankings, tetris).
- `services/`: regras de cada parte (jogos, rankings, news, perfil, captcha).
- `public/`: tudo o que abre no celular (HTML, CSS, JS, imagens e músicas).
  - `app.js`, `index.html`, `style.css`: tela principal e Modo Sorte.
  - `public/js/`: 100x100, news, perfil, ranking de diamantes.
  - imagens: logo-centro.png (verso da carta da memória), icone-roleta-*.png, roleta-premium.png.
  - músicas: musica.mp3, musica-memoria.mp3, musica-sudoku.mp3.
- `captcha-conta/`: arquivos de instalação do captcha de pontos (confirmar se ainda é usado).
- `backup-captcha-...`: cópia antiga (não roda).

## Datas de campanha (no .env)

- `MEMORIA_FIM_EM`: quando a campanha do Jogo da Memória termina (hoje o jogo é livre) (confirmar).
- `TETRIS_FIM_CAMPEONATO`: fim do campeonato do Tetris.

## Horário

Roda sempre (os jogos podem ter data de fim pelas variáveis acima).

## Onde roda

- Nome no pm2: (preencher no mapa)
- Servidor: (preencher no mapa)
- URL do Mini App: em `MINI_APP_URL`
